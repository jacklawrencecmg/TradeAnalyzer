import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔍 Checking for model config changes...");

    // Check if any config changed in the last 5 minutes
    const { data: recentChanges, error: changesError } = await supabase
      .from("system_health_metrics")
      .select("*")
      .eq("metric_name", "model_config_changed")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (changesError) {
      throw new Error(`Failed to check config changes: ${changesError.message}`);
    }

    if (!recentChanges || recentChanges.length === 0) {
      console.log("✅ No config changes detected");
      return new Response(
        JSON.stringify({
          status: "no_changes",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📊 Found ${recentChanges.length} config change(s) in last 5 minutes`);

    // Check if rebuild already queued
    const { data: existingJob } = await supabase
      .from("system_health_metrics")
      .select("*")
      .eq("metric_name", "model_rebuild_queued")
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existingJob) {
      console.log("⏸️  Rebuild already queued, skipping");
      return new Response(
        JSON.stringify({
          status: "rebuild_already_queued",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Queue rebuild
    console.log("🚀 Queueing value rebuild...");

    const { error: queueError } = await supabase
      .from("system_health_metrics")
      .insert({
        metric_name: "model_rebuild_queued",
        metric_value: recentChanges.length,
        severity: "info",
        metadata: {
          reason: "config_changed",
          changes: recentChanges.map((c) => c.metadata),
          timestamp: new Date().toISOString(),
        },
      });

    if (queueError) {
      throw new Error(`Failed to queue rebuild: ${queueError.message}`);
    }

    // Trigger rebuild via edge function
    const { error: rebuildError } = await supabase.functions.invoke(
      "rebuild-player-values",
      {
        headers: {
          Authorization: `Bearer ${Deno.env.get("VITE_ADMIN_SYNC_SECRET")}`,
        },
        body: {
          reason: "config_changed",
          changes_count: recentChanges.length,
        },
      }
    );

    if (rebuildError) {
      console.error("⚠️  Rebuild trigger failed:", rebuildError);
      // Don't fail the whole function - rebuild can be retried
    } else {
      console.log("✅ Rebuild triggered successfully");
    }

    // Clear the config change flags (so we don't rebuild again)
    await supabase
      .from("system_health_metrics")
      .delete()
      .eq("metric_name", "model_config_changed")
      .in(
        "id",
        recentChanges.map((c) => c.id)
      );

    return new Response(
      JSON.stringify({
        status: "rebuild_triggered",
        changes_count: recentChanges.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Config monitor failed:", error);

    return new Response(
      JSON.stringify({
        error: String(error),
        status: "error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

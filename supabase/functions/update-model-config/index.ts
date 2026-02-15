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
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    const adminSecret = Deno.env.get("VITE_ADMIN_SYNC_SECRET");

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid ADMIN_SYNC_SECRET" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { updates, updated_by = "admin" } = await req.json();

    console.log(`🔧 Updating ${Object.keys(updates).length} config values...`);

    const results = {
      updated: [] as string[],
      failed: [] as Array<{ key: string; error: string }>,
    };

    // Update each config value
    for (const [key, value] of Object.entries(updates)) {
      try {
        // Validate value is a number
        const numValue = Number(value);
        if (isNaN(numValue)) {
          results.failed.push({ key, error: "Value must be a number" });
          continue;
        }

        // Get current config to validate bounds
        const { data: currentConfig, error: fetchError } = await supabase
          .from("model_config")
          .select("min_value, max_value")
          .eq("key", key)
          .maybeSingle();

        if (fetchError) {
          results.failed.push({ key, error: fetchError.message });
          continue;
        }

        if (!currentConfig) {
          results.failed.push({ key, error: "Config key not found" });
          continue;
        }

        // Validate bounds
        if (numValue < currentConfig.min_value || numValue > currentConfig.max_value) {
          results.failed.push({
            key,
            error: `Value ${numValue} outside allowed range [${currentConfig.min_value}, ${currentConfig.max_value}]`,
          });
          continue;
        }

        // Update value
        const { error: updateError } = await supabase
          .from("model_config")
          .update({
            value: numValue,
            updated_at: new Date().toISOString(),
            updated_by: updated_by,
          })
          .eq("key", key);

        if (updateError) {
          results.failed.push({ key, error: updateError.message });
        } else {
          results.updated.push(key);
          console.log(`   ✓ Updated ${key} = ${numValue}`);
        }
      } catch (error) {
        results.failed.push({ key, error: String(error) });
      }
    }

    // Log success metrics
    await supabase.from("system_health_metrics").insert({
      metric_name: "model_config_bulk_update",
      metric_value: results.updated.length,
      severity: "info",
      metadata: {
        updated: results.updated,
        failed: results.failed,
        updated_by,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`✅ Config update complete: ${results.updated.length} updated, ${results.failed.length} failed`);

    return new Response(
      JSON.stringify({
        success: results.failed.length === 0,
        updated: results.updated,
        failed: results.failed,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Config update failed:", error);

    return new Response(
      JSON.stringify({
        error: String(error),
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

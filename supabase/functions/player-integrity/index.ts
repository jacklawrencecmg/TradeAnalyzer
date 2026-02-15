import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check auth
    const authHeader = req.headers.get("Authorization");
    const adminSecret = Deno.env.get("VITE_ADMIN_SYNC_SECRET");

    if (!authHeader || !authHeader.includes(adminSecret || "")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integrity report
    const report = await getPlayerIntegrityReport(supabase);

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Player integrity error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function getPlayerIntegrityReport(supabase: any) {
  // 1. Unmapped players (no external IDs)
  const { data: unmapped } = await supabase
    .from("player_identity")
    .select("*")
    .is("sleeper_id", null)
    .is("espn_id", null)
    .is("gsis_id", null)
    .is("fantasypros_id", null)
    .eq("status", "active")
    .limit(50);

  // 2. Duplicates (unresolved conflicts)
  const { data: duplicates } = await supabase
    .from("player_identity_conflicts")
    .select("*")
    .eq("resolved", false)
    .order("confidence", { ascending: false })
    .limit(50);

  // 3. High-confidence conflicts
  const { data: criticalConflicts } = await supabase
    .from("player_identity_conflicts")
    .select("*")
    .eq("resolved", false)
    .gte("confidence", 0.9);

  // 4. Recent merges
  const { data: recentMerges } = await supabase
    .from("player_merge_log")
    .select("*")
    .order("merged_at", { ascending: false })
    .limit(20);

  // 5. Player stats
  const { data: playerStats } = await supabase
    .from("player_identity")
    .select("status");

  const stats = {
    total: playerStats?.length || 0,
    active: playerStats?.filter((p: any) => p.status === "active").length || 0,
    inactive: playerStats?.filter((p: any) => p.status === "inactive").length || 0,
    retired: playerStats?.filter((p: any) => p.status === "retired").length || 0,
  };

  // 6. Recent changes
  const { data: recentChanges } = await supabase
    .from("player_identity_history")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(50);

  return {
    summary: {
      unmappedPlayers: unmapped?.length || 0,
      unresolvedConflicts: duplicates?.length || 0,
      criticalConflicts: criticalConflicts?.length || 0,
      recentMerges: recentMerges?.length || 0,
      stats,
    },
    unmappedPlayers: unmapped || [],
    conflicts: duplicates || [],
    criticalConflicts: criticalConflicts || [],
    recentMerges: recentMerges || [],
    recentChanges: recentChanges || [],
    timestamp: new Date().toISOString(),
  };
}

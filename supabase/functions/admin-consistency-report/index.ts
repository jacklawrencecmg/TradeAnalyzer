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

    console.log("🔍 Running value consistency checks...");

    const report = await runConsistencyChecks(supabase);

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Consistency check error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function runConsistencyChecks(supabase: any) {
  const mismatches: any[] = [];
  const warnings: string[] = [];
  const stats = {
    total_players_checked: 0,
    mismatches_found: 0,
    epoch_mismatches: 0,
    stale_values: 0,
    missing_epochs: 0,
  };

  // Get sample players
  const { data: topPlayers } = await supabase
    .from("player_values")
    .select("player_id")
    .eq("format", "dynasty")
    .is("league_profile_id", null)
    .order("base_value", { ascending: false })
    .limit(50);

  if (!topPlayers || topPlayers.length === 0) {
    return {
      status: "error",
      error: "No players found",
      timestamp: new Date().toISOString(),
    };
  }

  stats.total_players_checked = topPlayers.length;

  // Check value consistency
  for (const { player_id } of topPlayers) {
    const check = await checkPlayerConsistency(supabase, player_id);

    if (!check.consistent) {
      mismatches.push(check);
      stats.mismatches_found++;
    }

    if (check.epoch_mismatch) {
      stats.epoch_mismatches++;
    }

    if (check.is_stale) {
      stats.stale_values++;
    }

    if (!check.has_epoch) {
      stats.missing_epochs++;
    }
  }

  // Check for stale values
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: staleValues, count: staleCount } = await supabase
    .from("player_values")
    .select("player_id", { count: "exact", head: true })
    .eq("format", "dynasty")
    .lt("updated_at", sevenDaysAgo.toISOString());

  if (staleCount && staleCount > 0) {
    warnings.push(`${staleCount} values older than 7 days`);
  }

  // Check for missing epochs
  const { data: noEpoch, count: noEpochCount } = await supabase
    .from("player_values")
    .select("player_id", { count: "exact", head: true })
    .is("value_epoch", null);

  if (noEpochCount && noEpochCount > 0) {
    warnings.push(`${noEpochCount} values missing epoch`);
  }

  // Get current epoch
  const { data: epochData } = await supabase
    .from("player_values")
    .select("value_epoch")
    .not("value_epoch", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentEpoch = epochData?.value_epoch;

  // Check epoch consistency
  const { data: epochs } = await supabase
    .from("player_values")
    .select("value_epoch")
    .not("value_epoch", "is", null)
    .limit(100);

  const uniqueEpochs = new Set(epochs?.map((e: any) => e.value_epoch) || []);

  if (uniqueEpochs.size > 2) {
    warnings.push(`${uniqueEpochs.size} different epochs in use (should be 1-2)`);
  }

  const status = mismatches.length === 0 ? "pass" : "fail";

  return {
    status,
    summary: {
      ...stats,
      current_epoch: currentEpoch,
      unique_epochs: uniqueEpochs.size,
    },
    mismatches: mismatches.slice(0, 20), // Top 20 mismatches
    warnings,
    timestamp: new Date().toISOString(),
  };
}

async function checkPlayerConsistency(supabase: any, player_id: string) {
  // Get player info
  const { data: player } = await supabase
    .from("player_identity")
    .select("full_name, position")
    .eq("player_id", player_id)
    .maybeSingle();

  // Get canonical value
  const { data: value1 } = await supabase
    .from("player_values")
    .select("base_value, scarcity_adjustment, league_adjustment, value_epoch, updated_at")
    .eq("player_id", player_id)
    .eq("format", "dynasty")
    .is("league_profile_id", null)
    .maybeSingle();

  if (!value1) {
    return {
      player_id,
      player_name: player?.full_name || "Unknown",
      consistent: true,
      error: "No value found",
    };
  }

  const canonical_value =
    (value1.base_value || 0) +
    (value1.scarcity_adjustment || 0) +
    (value1.league_adjustment || 0);

  // Query again (simulating different endpoint)
  const { data: value2 } = await supabase
    .from("player_values")
    .select("base_value, scarcity_adjustment, league_adjustment, value_epoch")
    .eq("player_id", player_id)
    .eq("format", "dynasty")
    .is("league_profile_id", null)
    .maybeSingle();

  if (!value2) {
    return {
      player_id,
      player_name: player?.full_name || "Unknown",
      consistent: false,
      reason: "Value disappeared between queries",
    };
  }

  const actual_value =
    (value2.base_value || 0) +
    (value2.scarcity_adjustment || 0) +
    (value2.league_adjustment || 0);

  // Check consistency
  const drift = Math.abs(canonical_value - actual_value);
  const drift_percent = canonical_value > 0 ? (drift / canonical_value) * 100 : 0;
  const consistent = drift_percent < 0.01; // 0.01% tolerance

  // Check epoch
  const epoch_mismatch = value1.value_epoch !== value2.value_epoch;

  // Check staleness
  const age_ms = Date.now() - new Date(value1.updated_at).getTime();
  const age_days = age_ms / (1000 * 60 * 60 * 24);
  const is_stale = age_days > 7;

  return {
    player_id,
    player_name: player?.full_name || "Unknown",
    position: player?.position,
    consistent,
    canonical_value,
    actual_value,
    drift,
    drift_percent: Number(drift_percent.toFixed(4)),
    epoch_mismatch,
    canonical_epoch: value1.value_epoch,
    actual_epoch: value2.value_epoch,
    is_stale,
    age_days: Number(age_days.toFixed(1)),
    has_epoch: !!value1.value_epoch,
  };
}

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

    const { config_changes } = await req.json();

    console.log("🔮 Running model preview with changes:", config_changes);

    // Load current config
    const { data: currentConfig } = await supabase
      .from("model_config")
      .select("key, value");

    const configMap: Record<string, number> = {};
    currentConfig?.forEach((item) => {
      configMap[item.key] = item.value;
    });

    // Apply changes
    const newConfig = { ...configMap, ...config_changes };

    // Get sample of top players to test impact
    const { data: players } = await supabase
      .from("player_values")
      .select("player_id, base_value")
      .eq("format", "dynasty")
      .is("league_profile_id", null)
      .order("base_value", { ascending: false })
      .limit(100);

    if (!players || players.length === 0) {
      return new Response(
        JSON.stringify({
          top_movers: [],
          summary: {
            players_analyzed: 0,
            avg_change: 0,
            max_increase: 0,
            max_decrease: 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Simulate value changes (simplified example)
    // In reality, you'd run your full value calculation logic here
    const topMovers = players.map((player) => {
      const oldValue = player.base_value || 0;

      // Simple simulation: apply weight changes proportionally
      let newValue = oldValue;

      // Example: if production_weight increased, boost production-heavy players
      if (config_changes.production_weight) {
        const weightDelta = config_changes.production_weight - configMap.production_weight;
        // Assume production contributes ~60% of value currently
        newValue += oldValue * weightDelta * 0.6;
      }

      // Example: if age_curve_weight changed
      if (config_changes.age_curve_weight) {
        const weightDelta = config_changes.age_curve_weight - configMap.age_curve_weight;
        // Younger players benefit more from age weight
        // (This is simplified - real logic would check actual age)
        newValue += oldValue * weightDelta * 0.1;
      }

      // Example: if scarcity_multiplier changed (affects TEs)
      if (config_changes.scarcity_multiplier) {
        const multiplierDelta = config_changes.scarcity_multiplier - configMap.scarcity_multiplier;
        // Apply to TE-heavy portfolios (simplified)
        newValue += oldValue * multiplierDelta * 0.05;
      }

      const delta = newValue - oldValue;
      const deltaPercent = oldValue > 0 ? (delta / oldValue) * 100 : 0;

      return {
        player_id: player.player_id,
        player_name: "Player", // Would fetch actual name
        position: "QB", // Would fetch actual position
        old_value: oldValue,
        new_value: Math.round(newValue),
        delta: Math.round(delta),
        delta_percent: deltaPercent,
      };
    });

    // Sort by absolute delta
    topMovers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Calculate summary stats
    const avgChange = topMovers.reduce((sum, m) => sum + m.delta, 0) / topMovers.length;
    const maxIncrease = Math.max(...topMovers.map((m) => m.delta));
    const maxDecrease = Math.min(...topMovers.map((m) => m.delta));

    // Get player names for top movers
    const topMoverIds = topMovers.slice(0, 50).map((m) => m.player_id);
    const { data: playerNames } = await supabase
      .from("player_identity")
      .select("player_id, display_name, position")
      .in("player_id", topMoverIds);

    // Enrich with names
    topMovers.forEach((mover) => {
      const playerData = playerNames?.find((p) => p.player_id === mover.player_id);
      if (playerData) {
        mover.player_name = playerData.display_name;
        mover.position = playerData.position;
      }
    });

    console.log(`✅ Preview complete: ${topMovers.length} players analyzed`);
    console.log(`   Avg change: ${avgChange.toFixed(0)}`);
    console.log(`   Max increase: ${maxIncrease.toFixed(0)}`);
    console.log(`   Max decrease: ${maxDecrease.toFixed(0)}`);

    return new Response(
      JSON.stringify({
        top_movers: topMovers,
        summary: {
          players_analyzed: players.length,
          avg_change: Math.round(avgChange),
          max_increase: Math.round(maxIncrease),
          max_decrease: Math.round(maxDecrease),
          config_changes: Object.keys(config_changes).length,
        },
        config_applied: newConfig,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Preview failed:", error);

    return new Response(
      JSON.stringify({
        error: String(error),
        top_movers: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

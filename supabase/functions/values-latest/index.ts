import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "dynasty_sf";
    const position = url.searchParams.get("position");

    if (!position) {
      return new Response(
        JSON.stringify({ error: "Position parameter required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let query = supabase
      .from("latest_player_values")
      .select("player_id, player_name, position, team, rank_overall, rank_position, base_value, adjusted_value, market_value, updated_at")
      .eq("format", format)
      .eq("position", position)
      .order("adjusted_value", { ascending: false })
      .limit(500);

    const { data, error } = await query;

    if (error) throw error;

    const players = (data || []).map((p: any) => ({
      player_id: p.player_id,
      full_name: p.player_name || "Unknown",
      player_position: p.position,
      team: p.team || null,
      position_rank: p.rank_position || null,
      ktc_value: p.market_value || p.base_value || 0,
      fdp_value: p.adjusted_value || p.base_value || 0,
      captured_at: p.updated_at || new Date().toISOString(),
    }));

    return new Response(
      JSON.stringify({
        success: true,
        format,
        position,
        count: players.length,
        players,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching latest values:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

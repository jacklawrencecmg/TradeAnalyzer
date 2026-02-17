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
    const format = url.searchParams.get("format") || "dynasty_combined";
    const asOfDate = url.searchParams.get("as_of_date") || new Date().toISOString().split("T")[0];
    const includeIdp = url.searchParams.get("include_idp") !== "false";
    const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
    const position = url.searchParams.get("position");
    const team = url.searchParams.get("team");
    const exportFormat = url.searchParams.get("export") || "json";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Try today's snapshot first, then fall back to most recent
    let snapshotData = null;
    let snapshotMeta = { created_at: new Date().toISOString(), offense_count: 0, idp_count: 0, total_count: 0 };

    const { data: todayData } = await supabase
      .from("top_1000_current")
      .select("items, offense_count, idp_count, total_count, created_at")
      .eq("format", format)
      .eq("as_of_date", asOfDate)
      .maybeSingle();

    if (todayData?.items) {
      snapshotData = todayData.items as any[];
      snapshotMeta = {
        created_at: todayData.created_at,
        offense_count: todayData.offense_count,
        idp_count: todayData.idp_count,
        total_count: todayData.total_count,
      };
    } else {
      // Fall back to most recent snapshot of any date
      const { data: recentData } = await supabase
        .from("top_1000_current")
        .select("items, offense_count, idp_count, total_count, created_at")
        .eq("format", format)
        .order("as_of_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentData?.items) {
        snapshotData = recentData.items as any[];
        snapshotMeta = {
          created_at: recentData.created_at,
          offense_count: recentData.offense_count,
          idp_count: recentData.idp_count,
          total_count: recentData.total_count,
        };
      } else {
        // Final fallback: build from latest_player_values directly
        const { data: liveData, error: liveError } = await supabase
          .from("latest_player_values")
          .select("player_id, player_name, position, team, base_value, adjusted_value, updated_at")
          .order("base_value", { ascending: false })
          .limit(1000);

        if (liveError) throw liveError;

        const offensePositions = ["QB", "RB", "WR", "TE"];
        const idpPositions = ["DL", "LB", "DB"];

        snapshotData = (liveData || []).map((p: any, idx: number) => ({
          rank: idx + 1,
          player_id: p.player_id,
          full_name: p.player_name || "Unknown",
          position: p.position || "?",
          team: p.team || null,
          dynasty_value: p.adjusted_value || p.base_value || 0,
          redraft_value: p.base_value || 0,
          overall_value: p.adjusted_value || p.base_value || 0,
          status: "active",
          age: null,
          source: "live",
          captured_at: p.updated_at || new Date().toISOString(),
        }));

        const offenseCount = snapshotData.filter((p: any) => offensePositions.includes(p.position)).length;
        const idpCount = snapshotData.filter((p: any) => idpPositions.includes(p.position)).length;
        snapshotMeta = {
          created_at: new Date().toISOString(),
          offense_count: offenseCount,
          idp_count: idpCount,
          total_count: snapshotData.length,
        };
      }
    }

    let players = snapshotData as any[];

    if (!includeIdp) {
      players = players.filter((p: any) => !["DL", "LB", "DB"].includes(p.position));
    }
    if (position) {
      players = players.filter((p: any) => p.position === position.toUpperCase());
    }
    if (team) {
      players = players.filter((p: any) => p.team && p.team.toUpperCase() === team.toUpperCase());
    }

    players = players.slice(0, limit).map((p: any, idx: number) => ({ ...p, rank: idx + 1 }));

    if (exportFormat === "csv") {
      const csv = generateCSV(players);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="top${limit}_${asOfDate}.csv"`,
        },
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({
        as_of_date: asOfDate,
        format,
        filters: { include_idp: includeIdp, position: position || null, team: team || null },
        stats: {
          total: players.length,
          offense: players.filter((p: any) => ["QB", "RB", "WR", "TE"].includes(p.position)).length,
          idp: players.filter((p: any) => ["DL", "LB", "DB"].includes(p.position)).length,
        },
        players,
        meta: snapshotMeta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error fetching Top 1000:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function generateCSV(players: any[]): string {
  const headers = ["Rank", "Player", "Position", "Team", "Dynasty Value", "Redraft Value", "Overall Value", "Status", "Age"];
  const rows = players.map(p => [p.rank, p.full_name, p.position, p.team || "", p.dynasty_value, p.redraft_value, p.overall_value, p.status || "", p.age || ""]);
  return [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
}

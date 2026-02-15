import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Edge Function: Get Top 1000
 *
 * Returns the Top 1000 fantasy players list including offense and IDP.
 * Query params:
 * - format: dynasty_combined (default) | dynasty_sf | dynasty_1qb
 * - as_of_date: YYYY-MM-DD (defaults to today)
 * - include_idp: true (default) | false
 * - limit: 1000 (default)
 * - position: filter by position (QB, RB, WR, TE, DL, LB, DB)
 * - team: filter by team
 * - export: csv | json (default json)
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Fetch from top_1000_current
    const { data, error } = await supabase
      .from("top_1000_current")
      .select("items, offense_count, idp_count, total_count, created_at")
      .eq("format", format)
      .eq("as_of_date", asOfDate)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || !data.items) {
      return new Response(
        JSON.stringify({
          error: "No data found for the specified date and format",
          format,
          as_of_date: asOfDate,
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let players = data.items as any[];

    // Apply filters
    if (!includeIdp) {
      players = players.filter(p => !["DL", "LB", "DB"].includes(p.position));
    }

    if (position) {
      players = players.filter(p => p.position === position.toUpperCase());
    }

    if (team) {
      players = players.filter(p => p.team && p.team.toUpperCase() === team.toUpperCase());
    }

    // Apply limit
    players = players.slice(0, limit);

    // Re-rank after filtering
    players = players.map((p, idx) => ({
      ...p,
      rank: idx + 1,
    }));

    // Export as CSV if requested
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

    // Return JSON
    return new Response(
      JSON.stringify({
        as_of_date: asOfDate,
        format,
        filters: {
          include_idp: includeIdp,
          position: position || null,
          team: team || null,
        },
        stats: {
          total: players.length,
          offense: players.filter(p => ["QB", "RB", "WR", "TE"].includes(p.position)).length,
          idp: players.filter(p => ["DL", "LB", "DB"].includes(p.position)).length,
        },
        players,
        meta: {
          created_at: data.created_at,
          offense_count: data.offense_count,
          idp_count: data.idp_count,
          total_count: data.total_count,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error fetching Top 1000:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});

function generateCSV(players: any[]): string {
  const headers = [
    "Rank",
    "Player",
    "Position",
    "Team",
    "Dynasty Value",
    "Redraft Value",
    "Overall Value",
    "Status",
    "Age",
  ];

  const rows = players.map(p => [
    p.rank,
    p.full_name,
    p.position,
    p.team || "",
    p.dynasty_value,
    p.redraft_value,
    p.overall_value,
    p.status || "",
    p.age || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

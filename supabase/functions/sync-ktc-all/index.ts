const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PositionResult {
  ok: boolean;
  position?: string;
  count?: number;
  total?: number;
  minRank?: number;
  maxRank?: number;
  error?: string;
  blocked?: boolean;
}

interface SyncAllResult {
  ok: boolean;
  QB?: PositionResult;
  RB?: PositionResult;
  WR?: PositionResult;
  TE?: PositionResult;
  captured_at: string;
  total_synced: number;
  errors: string[];
}

const POSITIONS = [
  { name: 'QB', endpoint: 'sync-ktc-qbs' },
  { name: 'RB', endpoint: 'sync-ktc-rbs' },
  { name: 'WR', endpoint: 'sync-ktc-wrs' },
  { name: 'TE', endpoint: 'sync-ktc-tes' },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'dynasty-superflex';

    const authHeader = req.headers.get('Authorization');
    const secretParam = url.searchParams.get('secret');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');
    const cronSecret = Deno.env.get('CRON_SECRET');

    const isAuthorized =
      (authHeader && authHeader === `Bearer ${adminSecret}`) ||
      (secretParam && secretParam === cronSecret);

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const result: SyncAllResult = {
      ok: true,
      captured_at: new Date().toISOString(),
      total_synced: 0,
      errors: [],
    };

    for (const position of POSITIONS) {
      try {
        const positionUrl = `${supabaseUrl}/functions/v1/${position.endpoint}?format=${format}`;
        const response = await fetch(positionUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader || `Bearer ${adminSecret}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data.ok) {
          result[position.name as keyof SyncAllResult] = {
            ok: true,
            position: data.position,
            count: data.count,
            total: data.total,
            minRank: data.minRank,
            maxRank: data.maxRank,
          };
          result.total_synced += data.count || 0;
        } else {
          result[position.name as keyof SyncAllResult] = {
            ok: false,
            error: data.error || 'Sync failed',
            blocked: data.blocked,
          };
          result.errors.push(`${position.name}: ${data.error || 'Unknown error'}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result[position.name as keyof SyncAllResult] = {
          ok: false,
          error: errorMsg,
        };
        result.errors.push(`${position.name}: ${errorMsg}`);
      }
    }

    result.ok = result.errors.length === 0;

    return new Response(
      JSON.stringify(result),
      {
        status: result.ok ? 200 : 207,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-all function:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        captured_at: new Date().toISOString(),
        total_synced: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

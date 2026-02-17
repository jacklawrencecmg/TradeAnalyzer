import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 100;
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const apiKey = req.headers.get('X-API-Key') || url.searchParams.get('api_key');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const position = url.searchParams.get('position');
    const format = url.searchParams.get('format') || 'json';

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing API key',
          message: 'Include X-API-Key header or api_key query parameter',
          docs: 'https://www.fantasydraftpros.com/api-docs'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: validationResult } = await supabase
      .rpc('validate_api_key', { p_api_key: apiKey })
      .maybeSingle();

    if (!validationResult || !validationResult.is_valid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid API key',
          message: 'The provided API key is invalid or inactive'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rateLimit = validationResult.rate_limit || DEFAULT_RATE_LIMIT;
    const currentUsage = validationResult.current_usage || 0;

    if (currentUsage >= rateLimit) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You have exceeded your rate limit of ${rateLimit} requests per hour`,
          limit: rateLimit,
          usage: currentUsage,
          reset_time: new Date(Date.now() + RATE_LIMIT_WINDOW_MS).toISOString()
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + RATE_LIMIT_WINDOW_MS).toISOString()
          }
        }
      );
    }

    const startTime = Date.now();

    let query = supabase
      .rpc('get_latest_player_values', {})
      .order('base_value', { ascending: false });

    if (position) {
      query = query.eq('position', position.toUpperCase());
    }

    query = query.limit(Math.min(limit, 1000));

    const { data: players, error: playersError } = await query;

    if (playersError) throw playersError;

    const responseTime = Date.now() - startTime;

    await supabase.rpc('log_api_usage', {
      p_api_key: apiKey,
      p_endpoint: '/public/rankings',
      p_params: { limit, position },
      p_status: 200,
      p_response_time: responseTime,
      p_user_agent: req.headers.get('user-agent') || '',
      p_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    });

    const rankings = players?.map((p, index) => ({
      rank: index + 1,
      player_id: p.player_id,
      full_name: p.full_name,
      position: p.position,
      team: p.team,
      value: Math.round(p.fdp_value || p.base_value || 0),
      age: p.age
    })) || [];

    if (format === 'csv') {
      const csv = [
        'rank,player_id,full_name,position,team,value,age',
        ...rankings.map(r =>
          `${r.rank},"${r.player_id}","${r.full_name}",${r.position},${r.team || ''},${r.value},${r.age || ''}`
        )
      ].join('\n');

      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="dynasty-rankings.csv"',
          'X-RateLimit-Limit': rateLimit.toString(),
          'X-RateLimit-Remaining': (rateLimit - currentUsage - 1).toString()
        }
      });
    }

    return new Response(
      JSON.stringify({
        rankings,
        meta: {
          count: rankings.length,
          filters: { position, limit },
          updated: new Date().toISOString(),
          attribution: 'Data via FDP Dynasty Values - https://www.fantasydraftpros.com'
        }
      }, null, 2),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimit.toString(),
          'X-RateLimit-Remaining': (rateLimit - currentUsage - 1).toString()
        }
      }
    );
  } catch (error) {
    console.error('Public API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

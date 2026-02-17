import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface HeadshotVerificationResult {
  total: number;
  verified: number;
  missing: number;
  duplicates: number;
  errors: number;
  broken: string[];
}

async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: HeadshotVerificationResult = {
      total: 0,
      verified: 0,
      missing: 0,
      duplicates: 0,
      errors: 0,
      broken: [],
    };

    const { data: headshots, error: fetchError } = await supabase
      .from('player_headshots')
      .select('player_id, headshot_url, source, is_override');

    if (fetchError) {
      throw new Error(`Failed to fetch headshots: ${fetchError.message}`);
    }

    result.total = headshots?.length || 0;

    const brokenUrls: string[] = [];
    const seenUrls = new Map<string, number>();

    for (const headshot of headshots || []) {
      const DEFAULT_SILHOUETTE = 'https://sleepercdn.com/images/v2/icons/player_default.webp';

      if (headshot.headshot_url === DEFAULT_SILHOUETTE) {
        result.missing++;
        continue;
      }

      const urlCount = seenUrls.get(headshot.headshot_url) || 0;
      seenUrls.set(headshot.headshot_url, urlCount + 1);

      const isValid = await verifyImageUrl(headshot.headshot_url);

      if (!isValid) {
        result.errors++;
        brokenUrls.push(headshot.headshot_url);

        if (!headshot.is_override) {
          await supabase
            .from('player_headshots')
            .update({
              headshot_url: DEFAULT_SILHOUETTE,
              source: 'fallback',
              confidence: 0,
            })
            .eq('player_id', headshot.player_id);
        }
      } else {
        result.verified++;
      }

      if (urlCount === 10 || urlCount === 25 || urlCount === 50) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    for (const [url, count] of seenUrls.entries()) {
      if (count > 1) {
        result.duplicates++;
      }
    }

    result.broken = brokenUrls.slice(0, 10);

    const percentMissing = result.total > 0
      ? ((result.missing / result.total) * 100).toFixed(1)
      : '0.0';
    const percentBroken = result.total > 0
      ? ((result.errors / result.total) * 100).toFixed(1)
      : '0.0';

    await supabase
      .from('system_health_metrics')
      .insert({
        metric_name: 'headshot_verification',
        metric_value: result.verified,
        metric_metadata: {
          total: result.total,
          verified: result.verified,
          missing: result.missing,
          duplicates: result.duplicates,
          errors: result.errors,
          percent_missing: percentMissing,
          percent_broken: percentBroken,
        },
      });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Headshot verification complete',
        result,
        summary: {
          percent_missing: `${percentMissing}%`,
          percent_broken: `${percentBroken}%`,
          percent_verified: `${((result.verified / result.total) * 100).toFixed(1)}%`,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in verify-headshots function:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

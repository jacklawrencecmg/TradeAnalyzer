import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TradeShareRequest {
  format: string;
  sideA: {
    players: Array<{ id: string; name: string; position: string; value: number }>;
    picks?: Array<{ round: number; year: number; value: number }>;
    faab?: number;
  };
  sideB: {
    players: Array<{ id: string; name: string; position: string; value: number }>;
    picks?: Array<{ round: number; year: number; value: number }>;
    faab?: number;
  };
  sideATotal: number;
  sideBTotal: number;
  fairnessPercentage: number;
  winner: 'side_a' | 'side_b' | 'even';
  recommendation?: string;
  hideValues?: boolean;
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      let userId = null;

      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (!authError && user) {
          userId = user.id;
        }
      }

      const body: TradeShareRequest = await req.json();

      const { format, sideA, sideB, sideATotal, sideBTotal, fairnessPercentage, winner, recommendation, hideValues } = body;

      if (!format || !sideA || !sideB || sideATotal === undefined || sideBTotal === undefined) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      let slug = '';
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const { data: slugData, error: slugError } = await supabase.rpc('generate_trade_slug');

        if (slugError) {
          throw new Error(`Failed to generate slug: ${slugError.message}`);
        }

        slug = slugData;

        const { data: existing } = await supabase
          .from('shared_trades')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (!existing) {
          break;
        }

        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique slug after multiple attempts');
      }

      const { data: trade, error: insertError } = await supabase
        .from('shared_trades')
        .insert({
          slug,
          format,
          side_a: sideA,
          side_b: sideB,
          side_a_total: sideATotal,
          side_b_total: sideBTotal,
          fairness_percentage: fairnessPercentage,
          winner,
          recommendation: recommendation || '',
          hide_values: hideValues || false,
          user_id: userId,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to save trade: ${insertError.message}`);
      }

      const shareUrl = `${req.headers.get('origin') || supabaseUrl}/trade/${slug}`;

      return new Response(
        JSON.stringify({
          ok: true,
          slug,
          url: shareUrl,
          trade,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const slug = url.searchParams.get('slug');

      if (!slug) {
        return new Response(
          JSON.stringify({ error: 'Missing slug parameter' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: trade, error: fetchError } = await supabase
        .from('shared_trades')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to fetch trade: ${fetchError.message}`);
      }

      if (!trade) {
        return new Response(
          JSON.stringify({ error: 'Trade not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      await supabase.rpc('increment_trade_view_count', { trade_slug: slug });

      return new Response(
        JSON.stringify({
          ok: true,
          trade,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in trade-share function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

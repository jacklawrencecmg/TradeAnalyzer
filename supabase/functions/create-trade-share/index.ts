import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { sideA, sideB, result, leagueSettings } = await req.json();

    if (!sideA || !sideB) {
      return new Response(
        JSON.stringify({ error: 'Missing sideA or sideB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const sideANames = sideA.map((p: any) => p.full_name || p.name).join(', ');
    const sideBNames = sideB.map((p: any) => p.full_name || p.name).join(', ');

    const slug = generateTradeSlug(sideANames, sideBNames);

    const shareData = {
      sideA,
      sideB,
      result,
      leagueSettings,
      created: new Date().toISOString()
    };

    const { data: existing } = await supabase
      .from('share_links')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('share_links')
        .update({ share_data: shareData })
        .eq('slug', slug);
    } else {
      await supabase
        .from('share_links')
        .insert({
          slug,
          share_type: 'trade',
          share_data: shareData
        });
    }

    const shareUrl = `https://www.fantasydraftpros.com/share/trade/${slug}`;

    return new Response(
      JSON.stringify({
        slug,
        url: shareUrl
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create Share Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create share link' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateTradeSlug(sideA: string, sideB: string): string {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 40);

  const slugA = normalize(sideA);
  const slugB = normalize(sideB);

  return `${slugA}-for-${slugB}`;
}

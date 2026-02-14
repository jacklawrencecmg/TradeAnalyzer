import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Session-Id',
};

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

    const sessionId = req.headers.get('X-Session-Id');
    if (!sessionId) {
      throw new Error('Session ID required');
    }

    if (req.method === 'GET') {
      const { data: alerts, error } = await supabase
        .rpc('get_unread_alerts', { p_session_id: sessionId });

      if (error) {
        throw new Error(`Failed to get alerts: ${error.message}`);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          alerts: alerts || [],
          count: alerts?.length || 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const { alert_ids } = await req.json();

      if (!alert_ids || !Array.isArray(alert_ids)) {
        throw new Error('Alert IDs array required');
      }

      const { data: count, error } = await supabase
        .rpc('mark_alerts_read', {
          p_session_id: sessionId,
          p_alert_ids: alert_ids
        });

      if (error) {
        throw new Error(`Failed to mark alerts as read: ${error.message}`);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          message: `${count} alerts marked as read`,
          count,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error with alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

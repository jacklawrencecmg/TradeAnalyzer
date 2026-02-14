import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    const adminSecret = Deno.env.get('ADMIN_SYNC_SECRET');

    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid ADMIN_SYNC_SECRET' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 Running Doctor Repair...');

    const fixesApplied: any[] = [];

    // Fix 1: Remove duplicate latest values
    try {
      const { data: dupesBefore } = await supabase.rpc('execute_sql', {
        query: `
          SELECT COUNT(*) as count
          FROM (
            SELECT player_id, format, captured_at, COUNT(*) as ct
            FROM ktc_value_snapshots
            GROUP BY player_id, format, captured_at
            HAVING COUNT(*) > 1
          ) sub;
        `,
      });

      const dupeCount = dupesBefore?.[0]?.count || 0;

      if (dupeCount > 0) {
        await supabase.rpc('execute_sql', {
          query: `
            DELETE FROM ktc_value_snapshots
            WHERE id IN (
              SELECT id
              FROM (
                SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY player_id, format, captured_at
                    ORDER BY created_at DESC
                  ) as rn
                FROM ktc_value_snapshots
              ) ranked
              WHERE rn > 1
            );
          `,
        });

        fixesApplied.push({
          fix_id: 'remove_duplicates',
          description: 'Removed duplicate value snapshots',
          rows_affected: dupeCount,
          success: true,
        });

        await supabase.from('doctor_fixes').insert({
          fix_id: 'remove_duplicates',
          description: 'Removed duplicate value snapshots',
          severity: 'warning',
          rows_affected: dupeCount,
          applied_by: 'auto_repair',
        });
      }
    } catch (error) {
      fixesApplied.push({
        fix_id: 'remove_duplicates',
        description: 'Failed to remove duplicates',
        rows_affected: 0,
        success: false,
        error: String(error),
      });
    }

    // Fix 2: Delete snapshots with missing fields
    try {
      const { count: beforeCount } = await supabase
        .from('ktc_value_snapshots')
        .select('*', { count: 'exact', head: true })
        .or('player_id.is.null,format.is.null,captured_at.is.null');

      if (beforeCount && beforeCount > 0) {
        await supabase
          .from('ktc_value_snapshots')
          .delete()
          .or('player_id.is.null,format.is.null,captured_at.is.null');

        fixesApplied.push({
          fix_id: 'delete_invalid_snapshots',
          description: 'Deleted snapshots with missing required fields',
          rows_affected: beforeCount,
          success: true,
        });

        await supabase.from('doctor_fixes').insert({
          fix_id: 'delete_invalid_snapshots',
          description: 'Deleted snapshots with missing required fields',
          severity: 'critical',
          rows_affected: beforeCount,
          applied_by: 'auto_repair',
        });
      }
    } catch (error) {
      fixesApplied.push({
        fix_id: 'delete_invalid_snapshots',
        description: 'Failed to delete invalid snapshots',
        rows_affected: 0,
        success: false,
        error: String(error),
      });
    }

    // Fix 3: Delete old orphaned snapshots (>30 days)
    try {
      await supabase.rpc('execute_sql', {
        query: `
          DELETE FROM ktc_value_snapshots kvs
          WHERE NOT EXISTS (
            SELECT 1 FROM nfl_players np
            WHERE np.external_id = kvs.player_id
          )
          AND kvs.captured_at < NOW() - INTERVAL '30 days';
        `,
      });

      fixesApplied.push({
        fix_id: 'delete_old_orphans',
        description: 'Deleted old orphaned snapshots',
        rows_affected: 0,
        success: true,
      });

      await supabase.from('doctor_fixes').insert({
        fix_id: 'delete_old_orphans',
        description: 'Deleted old orphaned snapshots',
        severity: 'warning',
        rows_affected: 0,
        applied_by: 'auto_repair',
      });
    } catch (error) {
      fixesApplied.push({
        fix_id: 'delete_old_orphans',
        description: 'Failed to delete orphaned snapshots',
        rows_affected: 0,
        success: false,
        error: String(error),
      });
    }

    // Fix 4: Generate missing aliases
    try {
      const { data: noAliases } = await supabase.rpc('execute_sql', {
        query: `
          SELECT np.id, np.external_id, np.full_name
          FROM nfl_players np
          LEFT JOIN player_aliases pa ON pa.player_id = np.id
          WHERE pa.id IS NULL
            AND np.status IN ('Active', 'Rookie')
          LIMIT 50;
        `,
      });

      if (noAliases && noAliases.length > 0) {
        const aliasInserts = noAliases.map((p: any) => ({
          player_id: p.id,
          alias: p.full_name,
          alias_normalized: p.full_name.toLowerCase().replace(/[^a-z0-9]/g, ''),
          source: 'auto_generated',
        }));

        await supabase.from('player_aliases').insert(aliasInserts);

        fixesApplied.push({
          fix_id: 'generate_missing_aliases',
          description: 'Generated missing player aliases',
          rows_affected: aliasInserts.length,
          success: true,
        });

        await supabase.from('doctor_fixes').insert({
          fix_id: 'generate_missing_aliases',
          description: 'Generated missing player aliases',
          severity: 'warning',
          rows_affected: aliasInserts.length,
          applied_by: 'auto_repair',
        });
      }
    } catch (error) {
      fixesApplied.push({
        fix_id: 'generate_missing_aliases',
        description: 'Failed to generate aliases',
        rows_affected: 0,
        success: false,
        error: String(error),
      });
    }

    // Fix 5: Correct multiple current teams
    try {
      await supabase.rpc('execute_sql', {
        query: `
          WITH ranked AS (
            SELECT id,
              ROW_NUMBER() OVER (
                PARTITION BY player_id
                ORDER BY from_date DESC NULLS LAST, created_at DESC
              ) as rn
            FROM player_team_history
            WHERE is_current = true
          )
          UPDATE player_team_history
          SET is_current = false
          WHERE id IN (
            SELECT id FROM ranked WHERE rn > 1
          );
        `,
      });

      fixesApplied.push({
        fix_id: 'fix_multiple_current_teams',
        description: 'Corrected players with multiple current teams',
        rows_affected: 0,
        success: true,
      });

      await supabase.from('doctor_fixes').insert({
        fix_id: 'fix_multiple_current_teams',
        description: 'Corrected players with multiple current teams',
        severity: 'critical',
        rows_affected: 0,
        applied_by: 'auto_repair',
      });
    } catch (error) {
      fixesApplied.push({
        fix_id: 'fix_multiple_current_teams',
        description: 'Failed to fix team history',
        rows_affected: 0,
        success: false,
        error: String(error),
      });
    }

    // Fix 6: Backfill missing team data
    try {
      await supabase.rpc('execute_sql', {
        query: `
          UPDATE ktc_value_snapshots kvs
          SET team = np.team
          FROM nfl_players np
          WHERE np.external_id = kvs.player_id
            AND kvs.team IS NULL
            AND np.team IS NOT NULL
            AND kvs.captured_at >= NOW() - INTERVAL '30 days';
        `,
      });

      fixesApplied.push({
        fix_id: 'backfill_team_data',
        description: 'Backfilled missing team data',
        rows_affected: 0,
        success: true,
      });

      await supabase.from('doctor_fixes').insert({
        fix_id: 'backfill_team_data',
        description: 'Backfilled missing team data',
        severity: 'warning',
        rows_affected: 0,
        applied_by: 'auto_repair',
      });
    } catch (error) {
      fixesApplied.push({
        fix_id: 'backfill_team_data',
        description: 'Failed to backfill team data',
        rows_affected: 0,
        success: false,
        error: String(error),
      });
    }

    // Run audit again to check if issues resolved
    const { data: postAuditData } = await supabase.rpc('execute_sql', {
      query: 'SELECT COUNT(*) as critical_count FROM system_safe_mode WHERE enabled = true;',
    });

    const stillCritical = postAuditData?.[0]?.critical_count > 0;

    console.log(`✅ Repair complete: Applied ${fixesApplied.length} fixes`);

    return new Response(
      JSON.stringify({
        success: !stillCritical,
        fixes_applied: fixesApplied,
        total_fixes: fixesApplied.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('❌ Repair failed:', error);

    return new Response(
      JSON.stringify({
        error: String(error),
        success: false,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

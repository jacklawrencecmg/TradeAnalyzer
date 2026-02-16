import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RbTeamData {
  player_id: string;
  player_name: string;
  age: number | null;
  team: string | null;
  ktc_value: number;
  position_rank: number;
  depth_role: string | null;
  workload_tier: string | null;
  contract_security: string | null;
}

interface InferredContext {
  depth_role: string;
  workload_tier: string;
  contract_security: string;
  confidence: number;
  reasoning: string;
}

function inferRbContext(rb: RbTeamData, teamRBs: RbTeamData[]): InferredContext {
  const sortedTeamRBs = [...teamRBs].sort((a, b) => b.ktc_value - a.ktc_value);
  const rbRank = sortedTeamRBs.findIndex(r => r.player_id === rb.player_id) + 1;

  const depthRole = inferDepthRole(rb, sortedTeamRBs, rbRank);
  const workloadTier = inferWorkloadTier(rb, depthRole, rbRank);
  const contractSecurity = inferContractSecurity(rb, depthRole);
  const confidence = calculateConfidence(rb, sortedTeamRBs, rbRank);
  const reasoning = generateReasoning(rb, sortedTeamRBs, rbRank, depthRole);

  return {
    depth_role: depthRole,
    workload_tier: workloadTier,
    contract_security: contractSecurity,
    confidence,
    reasoning,
  };
}

function inferDepthRole(
  rb: RbTeamData,
  sortedTeamRBs: RbTeamData[],
  rbRank: number
): string {
  if (!rb.team) return 'backup';
  if (sortedTeamRBs.length === 1) return 'feature';

  if (rbRank === 1) {
    const rb2 = sortedTeamRBs[1];
    const valueGap = rb.ktc_value - (rb2?.ktc_value || 0);
    const gapRatio = rb2 ? valueGap / rb2.ktc_value : 1;

    if (gapRatio > 0.5) return 'feature';
    if (gapRatio > 0.2) return 'lead_committee';
    return 'committee';
  }

  if (rbRank === 2) {
    const rb1 = sortedTeamRBs[0];
    const valueGap = rb1.ktc_value - rb.ktc_value;
    const gapRatio = valueGap / rb.ktc_value;

    if (gapRatio > 1.0) return 'handcuff';
    return 'committee';
  }

  if (rbRank === 3) {
    const rb1 = sortedTeamRBs[0];
    if (rb1.ktc_value > 5000) return 'handcuff';
    return 'backup';
  }

  return 'backup';
}

function inferWorkloadTier(rb: RbTeamData, depthRole: string, rbRank: number): string {
  if (depthRole === 'feature') {
    return rb.ktc_value > 7000 ? 'elite' : 'solid';
  }
  if (depthRole === 'lead_committee') {
    return rb.ktc_value > 6000 ? 'elite' : 'solid';
  }
  if (depthRole === 'committee') {
    return rb.ktc_value > 4000 ? 'solid' : 'light';
  }
  return 'light';
}

function inferContractSecurity(rb: RbTeamData, depthRole: string): string {
  if (rb.age && rb.age <= 23) return 'high';
  if ((depthRole === 'feature' || depthRole === 'lead_committee') && rb.ktc_value > 6000) {
    return 'high';
  }
  if (rb.age && rb.age >= 28) return 'low';
  if (depthRole === 'backup') return 'low';
  return 'medium';
}

function calculateConfidence(
  rb: RbTeamData,
  sortedTeamRBs: RbTeamData[],
  rbRank: number
): number {
  let confidence = 0.5;

  if (!rb.team) return 0.3;
  if (sortedTeamRBs.length === 1) confidence = 0.9;

  if (rbRank === 1) {
    const rb2 = sortedTeamRBs[1];
    if (rb2) {
      const gapRatio = (rb.ktc_value - rb2.ktc_value) / rb2.ktc_value;
      if (gapRatio > 0.5) confidence = 0.95;
      else if (gapRatio > 0.2) confidence = 0.85;
      else confidence = 0.75;
    } else {
      confidence = 0.9;
    }
  } else if (rbRank === 2) {
    confidence = 0.8;
  } else if (rbRank >= 3) {
    confidence = 0.7;
  }

  if (rb.ktc_value > 8000) confidence = Math.min(1.0, confidence + 0.1);
  if (rb.ktc_value < 1000) confidence = Math.max(0.3, confidence - 0.2);
  if (rb.age && (rb.age <= 23 || rb.age >= 28)) {
    confidence = Math.min(1.0, confidence + 0.05);
  }

  return Math.round(confidence * 100) / 100;
}

function generateReasoning(
  rb: RbTeamData,
  sortedTeamRBs: RbTeamData[],
  rbRank: number,
  depthRole: string
): string {
  const reasons: string[] = [];

  if (rbRank === 1) {
    reasons.push(`RB1 on ${rb.team}`);
    const rb2 = sortedTeamRBs[1];
    if (rb2) {
      const gap = rb.ktc_value - rb2.ktc_value;
      if (gap > rb2.ktc_value * 0.5) {
        reasons.push('Large value gap to RB2');
      } else if (gap > rb2.ktc_value * 0.2) {
        reasons.push('Moderate gap to RB2');
      } else {
        reasons.push('Close competition with RB2');
      }
    }
  } else if (rbRank === 2) {
    reasons.push(`RB2 on ${rb.team}`);
  } else if (rbRank >= 3) {
    reasons.push(`RB${rbRank} on ${rb.team}`);
  }

  if (rb.age) {
    if (rb.age <= 23) reasons.push('Young player (rookie contract)');
    else if (rb.age >= 28) reasons.push('Veteran (age risk)');
  }

  if (rb.ktc_value > 8000) {
    reasons.push('Elite dynasty value');
  } else if (rb.ktc_value < 1000) {
    reasons.push('Low dynasty value');
  }

  return reasons.join('; ');
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

    const { data: rbs, error: rbsError } = await supabase
      .from('latest_player_values')
      .select('player_id, player_name, metadata, team, market_value, position')
      .eq('position', 'RB')
      .order('market_value', { ascending: false });

    if (rbsError) throw rbsError;
    if (!rbs || rbs.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No RBs found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rbsByTeam = new Map<string, RbTeamData[]>();
    for (const rb of rbs) {
      const team = rb.team || 'FA';
      if (!rbsByTeam.has(team)) {
        rbsByTeam.set(team, []);
      }
      rbsByTeam.get(team)!.push({
        player_id: rb.player_id,
        player_name: rb.player_name,
        age: rb.metadata?.age || null,
        team: rb.team,
        ktc_value: rb.market_value || 0,
        position_rank: 0,
        depth_role: rb.metadata?.depth_role || null,
        workload_tier: rb.metadata?.workload_tier || null,
        contract_security: rb.metadata?.contract_security || null,
      });
    }

    let createdCount = 0;
    let skippedCount = 0;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const [team, teamRBs] of rbsByTeam) {
      for (const rb of teamRBs) {
        const hasManualContext = rb.depth_role || rb.workload_tier || rb.contract_security;
        if (hasManualContext) {
          skippedCount++;
          continue;
        }

        const inference = inferRbContext(rb, teamRBs);

        const { data: existingSuggestion } = await supabase
          .from('player_context_suggestions')
          .select('id')
          .eq('player_id', rb.player_id)
          .eq('status', 'pending')
          .maybeSingle();

        if (existingSuggestion) {
          const { error: updateError } = await supabase
            .from('player_context_suggestions')
            .update({
              suggested_depth_role: inference.depth_role,
              suggested_workload_tier: inference.workload_tier,
              suggested_contract_security: inference.contract_security,
              confidence: inference.confidence,
              reasoning: inference.reasoning,
              updated_at: now,
              expires_at: expiresAt,
            })
            .eq('id', existingSuggestion.id);

          if (!updateError) createdCount++;
        } else {
          const { error: insertError } = await supabase
            .from('player_context_suggestions')
            .insert({
              player_id: rb.player_id,
              suggested_depth_role: inference.depth_role,
              suggested_workload_tier: inference.workload_tier,
              suggested_contract_security: inference.contract_security,
              confidence: inference.confidence,
              reasoning: inference.reasoning,
              status: 'pending',
              created_at: now,
              updated_at: now,
              expires_at: expiresAt,
            });

          if (!insertError) createdCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        suggestions_created: createdCount,
        players_with_manual_context: skippedCount,
        total_rbs: rbs.length,
        teams_analyzed: rbsByTeam.size,
        timestamp: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating suggestions:', error);
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

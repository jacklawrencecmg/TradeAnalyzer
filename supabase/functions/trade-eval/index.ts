import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const staticPickValueChart: Record<string, number> = {
  '1.01': 9500, '1.02': 9200, '1.03': 8900, '1.04': 8600, '1.05': 8300,
  '1.06': 8000, '1.07': 7700, '1.08': 7400, '1.09': 7100, '1.10': 6800,
  '1.11': 6500, '1.12': 6200,
  'early_1st': 6500, 'mid_1st': 5500, 'late_1st': 4800,
  '2nd': 2500, 'early_2nd': 3200, 'mid_2nd': 2500, 'late_2nd': 2600,
  '3rd': 1200, '4th': 500,
};

function normalizePickName(pick: string): string {
  const lower = pick.toLowerCase().trim();
  if (lower.includes('early') && lower.includes('1')) return 'early_1st';
  if (lower.includes('mid') && lower.includes('1')) return 'mid_1st';
  if (lower.includes('late') && lower.includes('1')) return 'late_1st';
  if (lower.includes('early') && lower.includes('2')) return 'early_2nd';
  if (lower.includes('mid') && lower.includes('2')) return 'mid_2nd';
  if (lower.includes('late') && lower.includes('2')) return 'late_2nd';
  if (lower.match(/1\.0[1-9]|1\.1[0-2]/)) return lower.replace(/\s/g, '');
  if (lower.includes('2nd') || lower.includes('2.')) return '2nd';
  if (lower.includes('3rd') || lower.includes('3.')) return '3rd';
  if (lower.includes('4th') || lower.includes('4.')) return '4th';
  if (lower.includes('1st') || lower.includes('1.')) return 'mid_1st';
  return lower;
}

async function getPickValue(pick: string, supabase: any): Promise<{ value: number; phase?: string; adjustment?: number; baseValue?: number }> {
  const normalized = normalizePickName(pick);

  const dynamicPickTypes = ['early_1st', 'mid_1st', 'late_1st', 'early_2nd', 'late_2nd', '3rd'];

  if (dynamicPickTypes.includes(normalized)) {
    const currentYear = new Date().getFullYear();
    const { data: pickData } = await supabase
      .from('rookie_pick_values')
      .select('*')
      .eq('pick', normalized)
      .eq('season', currentYear + 1)
      .maybeSingle();

    if (pickData) {
      const value = pickData.manual_override ? (pickData.override_value || pickData.adjusted_value) : pickData.adjusted_value;
      return {
        value,
        phase: pickData.phase,
        adjustment: pickData.adjusted_value - pickData.base_value,
        baseValue: pickData.base_value
      };
    }
  }

  return { value: staticPickValueChart[normalized] || 0 };
}

function isPick(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('1st') || lower.includes('2nd') || lower.includes('3rd') ||
         lower.includes('4th') || lower.match(/\d\.\d{2}/) !== null ||
         lower.includes('pick') || lower.includes('1.') || lower.includes('2.') ||
         lower.includes('3.') || lower.includes('4.');
}

interface TradePlayer {
  name: string;
  pos?: string;
}

interface TradeRequest {
  format: string;
  sideA: (TradePlayer | string)[];
  sideB: (TradePlayer | string)[];
}

interface PlayerValue {
  player_id: string;
  full_name: string;
  position: string;
  ktc_value: number;
  fdp_value: number;
  captured_at: string;
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const maxWords = Math.max(words1.length, words2.length);
  return commonWords / maxWords;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: TradeRequest = await req.json();
    const { format = 'dynasty_sf', sideA, sideB } = body;

    if (!sideA || !sideB || !Array.isArray(sideA) || !Array.isArray(sideB)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid request format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: allSnapshots, error } = await supabase
      .from('ktc_value_snapshots')
      .select('player_id, full_name, position, ktc_value, fdp_value, captured_at')
      .eq('format', format)
      .order('captured_at', { ascending: false });

    if (error) {
      throw error;
    }

    const latestByPlayer = new Map<string, PlayerValue>();
    for (const snapshot of allSnapshots || []) {
      const key = `${snapshot.full_name}_${snapshot.position}`;
      if (!latestByPlayer.has(key)) {
        latestByPlayer.set(key, snapshot);
      }
    }

    const lookupPlayer = async (item: TradePlayer | string) => {
      const name = typeof item === 'string' ? item : item.name;
      const pos = typeof item === 'string' ? undefined : item.pos;

      if (isPick(name)) {
        const pickResult = await getPickValue(name, supabase);
        if (pickResult.value > 0) {
          return {
            found: true,
            value: pickResult.value,
            name: name,
            isPick: true,
            pos: 'PICK',
            pickPhase: pickResult.phase,
            pickAdjustment: pickResult.adjustment,
            baseValue: pickResult.baseValue
          };
        }
        return {
          found: false,
          suggestions: ['Try: early 1st, mid 1st, late 1st, 1.01-1.12, 2nd, 3rd'],
          searchedName: name,
          searchedPos: 'PICK',
          isPick: true
        };
      }

      const searchPositions = pos ? [pos] : ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];

      for (const searchPos of searchPositions) {
        const key = `${name}_${searchPos}`;
        const exact = latestByPlayer.get(key);
        if (exact) {
          const isIDP = ['DL', 'LB', 'DB'].includes(exact.position);
          return {
            found: true,
            value: exact.fdp_value || exact.ktc_value,
            name: exact.full_name,
            pos: exact.position,
            isPick: false,
            positionGroup: isIDP ? 'IDP' : 'OFF'
          };
        }
      }

      let bestMatch: PlayerValue | null = null;
      let bestScore = 0;

      for (const [_, player] of latestByPlayer.entries()) {
        if (!pos || player.position === pos) {
          const score = calculateSimilarity(name, player.full_name);
          if (score > bestScore && score > 0.6) {
            bestScore = score;
            bestMatch = player;
          }
        }
      }

      if (bestMatch) {
        const suggestions = Array.from(latestByPlayer.values())
          .filter(p => !pos || p.position === pos)
          .map(p => ({
            name: p.full_name,
            similarity: calculateSimilarity(name, p.full_name),
          }))
          .filter(s => s.similarity > 0.4)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
          .map(s => s.name);

        return { found: false, suggestions, searchedName: name, searchedPos: pos || 'ANY' };
      }

      return { found: false, suggestions: [], searchedName: name, searchedPos: pos || 'ANY' };
    };

    let sideATotal = 0;
    let sideAOffenseTotal = 0;
    let sideAIDPTotal = 0;
    const sideADetails: any[] = [];
    const sideANotFound: any[] = [];
    let pickPhaseInfo: any = null;

    for (const item of sideA) {
      const result = await lookupPlayer(item);
      if (result.found) {
        sideATotal += result.value;
        if (result.positionGroup === 'IDP') {
          sideAIDPTotal += result.value;
        } else if (!result.isPick) {
          sideAOffenseTotal += result.value;
        }
        sideADetails.push({
          name: result.name,
          pos: result.pos,
          value: result.value,
          isPick: result.isPick || false,
          positionGroup: result.positionGroup,
          pickPhase: result.pickPhase,
          pickAdjustment: result.pickAdjustment,
          baseValue: result.baseValue
        });
        if (result.isPick && result.pickPhase && !pickPhaseInfo) {
          pickPhaseInfo = {
            phase: result.pickPhase,
            adjustment: result.pickAdjustment
          };
        }
      } else {
        sideANotFound.push({
          name: result.searchedName,
          pos: result.searchedPos,
          suggestions: result.suggestions
        });
      }
    }

    let sideBTotal = 0;
    let sideBOffenseTotal = 0;
    let sideBIDPTotal = 0;
    const sideBDetails: any[] = [];
    const sideBNotFound: any[] = [];

    for (const item of sideB) {
      const result = await lookupPlayer(item);
      if (result.found) {
        sideBTotal += result.value;
        if (result.positionGroup === 'IDP') {
          sideBIDPTotal += result.value;
        } else if (!result.isPick) {
          sideBOffenseTotal += result.value;
        }
        sideBDetails.push({
          name: result.name,
          pos: result.pos,
          value: result.value,
          isPick: result.isPick || false,
          positionGroup: result.positionGroup,
          pickPhase: result.pickPhase,
          pickAdjustment: result.pickAdjustment,
          baseValue: result.baseValue
        });
        if (result.isPick && result.pickPhase && !pickPhaseInfo) {
          pickPhaseInfo = {
            phase: result.pickPhase,
            adjustment: result.pickAdjustment
          };
        }
      } else {
        sideBNotFound.push({
          name: result.searchedName,
          pos: result.searchedPos,
          suggestions: result.suggestions
        });
      }
    }

    const difference = sideATotal - sideBTotal;
    const maxValue = Math.max(sideATotal, sideBTotal);
    const fairnessPercentage = maxValue > 0
      ? Math.round((Math.min(sideATotal, sideBTotal) / maxValue) * 100)
      : 100;

    let recommendation = '';
    if (Math.abs(difference) < 500) {
      recommendation = 'Fair trade - values are very close';
    } else if (fairnessPercentage >= 90) {
      recommendation = 'Fair trade - slight value difference';
    } else if (fairnessPercentage >= 75) {
      recommendation = difference > 0
        ? `Side A wins - consider adding ${Math.abs(difference)} value to Side B`
        : `Side B wins - consider adding ${Math.abs(difference)} value to Side A`;
    } else {
      recommendation = difference > 0
        ? `Side A strongly favored - needs ${Math.abs(difference)} more value on Side B`
        : `Side B strongly favored - needs ${Math.abs(difference)} more value on Side A`;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sideA_total: sideATotal,
        sideB_total: sideBTotal,
        sideA_offense_total: sideAOffenseTotal,
        sideA_idp_total: sideAIDPTotal,
        sideB_offense_total: sideBOffenseTotal,
        sideB_idp_total: sideBIDPTotal,
        difference: Math.abs(difference),
        fairness_percentage: fairnessPercentage,
        recommendation,
        sideA_details: sideADetails,
        sideB_details: sideBDetails,
        sideA_not_found: sideANotFound,
        sideB_not_found: sideBNotFound,
        pick_phase: pickPhaseInfo?.phase,
        pick_adjustment_applied: pickPhaseInfo ? true : false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in trade-eval function:', error);
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

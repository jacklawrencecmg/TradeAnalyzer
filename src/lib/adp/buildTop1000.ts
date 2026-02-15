import { supabase } from '../supabase';
import { adpToRedraftValue } from './adpToValue';
import { calculateIdpRedraftValue, isIdpPosition } from './idpFallback';
import { getLatestAdp } from './syncAdp';

interface PlayerData {
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  age?: number;
  depth_role?: string;
  injury_risk?: string;
  base_value?: number;
  fdp_value?: number;
}

interface Top1000Result {
  success: boolean;
  processed: number;
  errors: string[];
}

export async function buildTop1000(): Promise<Top1000Result> {
  const result: Top1000Result = {
    success: false,
    processed: 0,
    errors: [],
  };

  try {
    const { data: players, error: fetchError } = await supabase
      .from('nfl_players_registry')
      .select('player_id, full_name, position, current_team, birth_date')
      .not('position', 'in', '(K,P,LS)')
      .order('full_name');

    if (fetchError) {
      result.errors.push(`Failed to fetch players: ${fetchError.message}`);
      return result;
    }

    if (!players || players.length === 0) {
      result.errors.push('No players found in registry');
      return result;
    }

    for (const player of players) {
      try {
        const age = player.birth_date
          ? new Date().getFullYear() - new Date(player.birth_date).getFullYear()
          : undefined;

        const { data: existingValue } = await supabase
          .from('player_values')
          .select('base_value, fdp_value, depth_role, injury_risk')
          .eq('player_id', player.player_id)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();

        const adp = await getLatestAdp(player.player_id);

        let redraftValue: number;
        let redraftValueSource: string;
        let dynastyValue: number;

        if (adp && adp > 0) {
          redraftValue = adpToRedraftValue(adp);
          redraftValueSource = 'adp';
        } else if (isIdpPosition(player.position)) {
          redraftValue = calculateIdpRedraftValue({
            position: player.position,
            age,
            depth_role: existingValue?.depth_role,
            injury_risk: existingValue?.injury_risk,
          });
          redraftValueSource = 'idp_tier';
        } else {
          redraftValue = calculateHeuristicRedraftValue(
            player.position,
            age,
            existingValue?.base_value || 0
          );
          redraftValueSource = 'heuristic';
        }

        dynastyValue = existingValue?.fdp_value || existingValue?.base_value || redraftValue;

        const { error: upsertError } = await supabase.from('player_values').upsert(
          {
            player_id: player.player_id,
            player_name: player.full_name,
            position: player.position,
            team: player.current_team,
            base_value: existingValue?.base_value || redraftValue,
            fdp_value: existingValue?.fdp_value || dynastyValue,
            dynasty_value: dynastyValue,
            redraft_value: redraftValue,
            redraft_value_source: redraftValueSource,
            age,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'player_id' }
        );

        if (upsertError) {
          result.errors.push(`Failed to update ${player.full_name}: ${upsertError.message}`);
        } else {
          result.processed++;
        }
      } catch (err) {
        result.errors.push(
          `Error processing ${player.full_name}: ${err instanceof Error ? err.message : 'Unknown'}`
        );
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown error');
    return result;
  }
}

function calculateHeuristicRedraftValue(position: string, age: number | undefined, baseValue: number): number {
  let value = baseValue || 5000;

  if (position === 'QB') {
    if (age && age < 25) {
      value *= 0.7;
    } else if (age && age > 35) {
      value *= 0.8;
    }
  } else if (position === 'RB') {
    if (age && age < 24) {
      value *= 1.1;
    } else if (age && age > 28) {
      value *= 0.6;
    }
  } else if (position === 'WR') {
    if (age && age < 25) {
      value *= 0.9;
    } else if (age && age > 30) {
      value *= 0.75;
    }
  } else if (position === 'TE') {
    if (age && age < 25) {
      value *= 0.85;
    } else if (age && age > 30) {
      value *= 0.8;
    }
  }

  return Math.max(0, Math.min(10000, Math.round(value)));
}

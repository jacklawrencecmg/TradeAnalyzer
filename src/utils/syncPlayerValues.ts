import { supabase } from '../lib/supabase';

const VALUE_SCALE_FACTOR = 100.0 / 10000.0;

interface FDPPlayer {
  sleeperId: string;
  value: string;
  position: string;
  player: string;
  team: string;
}

async function fetchFDPValues(isSuperflex: boolean = false): Promise<Record<string, number>> {
  const format = isSuperflex ? '2' : '1';
  const currentYear = new Date().getFullYear();
  const targetYear = new Date().getMonth() >= 8 ? currentYear + 1 : currentYear;

  try {
    const response = await fetch(
      `https://api.fantasydraftprospects.com/api/values/${targetYear}?format=${format}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data: FDPPlayer[] = await response.json();
      const values: Record<string, { value: number; position: string; name: string; team: string }> = {};

      data.forEach((item) => {
        if (item.sleeperId && item.value) {
          const rawValue = parseInt(item.value, 10);
          values[item.sleeperId] = {
            value: parseFloat((rawValue * VALUE_SCALE_FACTOR).toFixed(1)),
            position: item.position,
            name: item.player,
            team: item.team || null,
          };
        }
      });

      return Object.fromEntries(
        Object.entries(values).map(([id, data]) => [id, data.value])
      );
    }
  } catch (error) {
    console.error('Failed to fetch FDP values:', error);
  }

  try {
    const fallbackResponse = await fetch(
      `https://api.keeptradecut.com/bff/dynasty/players?format=${format}`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (fallbackResponse.ok) {
      const data: FDPPlayer[] = await fallbackResponse.json();
      const values: Record<string, number> = {};

      data.forEach((item) => {
        if (item.sleeperId && item.value) {
          const rawValue = parseInt(item.value, 10);
          values[item.sleeperId] = parseFloat((rawValue * VALUE_SCALE_FACTOR).toFixed(1));
        }
      });

      return values;
    }
  } catch (error) {
    console.error('Failed to fetch KTC fallback values:', error);
  }

  return {};
}

export async function syncPlayerValuesToDatabase(isSuperflex: boolean = false): Promise<number> {
  try {
    const sleeperResponse = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (!sleeperResponse.ok) throw new Error('Failed to fetch Sleeper players');

    const sleeperPlayers = await sleeperResponse.json();
    const fdpValues = await fetchFDPValues(isSuperflex);

    if (Object.keys(fdpValues).length === 0) {
      console.error('No FDP values fetched');
      return 0;
    }

    const playerValues: any[] = [];

    Object.entries(sleeperPlayers).forEach(([playerId, playerData]: [string, any]) => {
      if (!playerData.position || !['QB', 'RB', 'WR', 'TE'].includes(playerData.position)) {
        return;
      }

      const fdpValue = fdpValues[playerId];
      if (!fdpValue || fdpValue === 0) return;

      let trend: 'up' | 'down' | 'stable' = 'stable';

      playerValues.push({
        player_id: playerId,
        player_name: playerData.full_name || `${playerData.first_name} ${playerData.last_name}`,
        position: playerData.position,
        team: playerData.team || null,
        base_value: fdpValue * 0.8,
        fdp_value: fdpValue,
        trend: trend,
        last_updated: new Date().toISOString(),
        injury_status: playerData.injury_status?.toLowerCase() || null,
        age: playerData.age || null,
        years_experience: playerData.years_exp || null,
        metadata: {
          source: 'fantasy_draft_pros',
          is_superflex: isSuperflex,
          sleeper_status: playerData.status,
          sleeper_injury_status: playerData.injury_status,
        },
      });
    });

    if (playerValues.length > 0) {
      const { error } = await supabase
        .from('player_values')
        .upsert(playerValues, { onConflict: 'player_id' });

      if (error) {
        console.error('Error upserting player values:', error);
        throw error;
      }

      console.log(`Successfully synced ${playerValues.length} player values to database`);
      return playerValues.length;
    }

    return 0;
  } catch (error) {
    console.error('Error syncing player values:', error);
    return 0;
  }
}

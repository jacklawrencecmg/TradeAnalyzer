import { supabase } from '../lib/supabase';

interface FDPPlayer {
  sleeperId: string;
  value: string;
  position: string;
  player: string;
  team: string;
}

interface PlayerValueData {
  value: number;
  position: string;
  name: string;
  team: string;
}

function normalizeValue(rawValue: number, minValue: number, maxValue: number): number {
  if (maxValue === minValue) return 5000;

  const normalized = ((rawValue - minValue) / (maxValue - minValue)) * 10000;
  return Math.max(0, Math.min(10000, normalized));
}

async function fetchFDPValues(isSuperflex: boolean = false): Promise<Record<string, PlayerValueData>> {
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
      const rawValues: Array<{ id: string; value: number; position: string; name: string; team: string }> = [];

      data.forEach((item) => {
        if (item.sleeperId && item.value) {
          const rawValue = parseInt(item.value, 10);
          if (rawValue > 0) {
            rawValues.push({
              id: item.sleeperId,
              value: rawValue,
              position: item.position,
              name: item.player,
              team: item.team || null,
            });
          }
        }
      });

      if (rawValues.length === 0) throw new Error('No valid values from FDP');

      const minValue = Math.min(...rawValues.map(v => v.value));
      const maxValue = Math.max(...rawValues.map(v => v.value));

      const normalizedValues: Record<string, PlayerValueData> = {};
      rawValues.forEach((item) => {
        normalizedValues[item.id] = {
          value: normalizeValue(item.value, minValue, maxValue),
          position: item.position,
          name: item.name,
          team: item.team,
        };
      });

      console.log(`FDP: Normalized ${rawValues.length} values from range ${minValue}-${maxValue} to 0-10000`);
      return normalizedValues;
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
      const rawValues: Array<{ id: string; value: number; position: string; name: string; team: string }> = [];

      data.forEach((item) => {
        if (item.sleeperId && item.value) {
          const rawValue = parseInt(item.value, 10);
          if (rawValue > 0) {
            rawValues.push({
              id: item.sleeperId,
              value: rawValue,
              position: item.position,
              name: item.player,
              team: item.team || null,
            });
          }
        }
      });

      if (rawValues.length === 0) throw new Error('No valid values from KTC');

      const minValue = Math.min(...rawValues.map(v => v.value));
      const maxValue = Math.max(...rawValues.map(v => v.value));

      const normalizedValues: Record<string, PlayerValueData> = {};
      rawValues.forEach((item) => {
        normalizedValues[item.id] = {
          value: normalizeValue(item.value, minValue, maxValue),
          position: item.position,
          name: item.name,
          team: item.team,
        };
      });

      console.log(`KTC: Normalized ${rawValues.length} values from range ${minValue}-${maxValue} to 0-10000`);
      return normalizedValues;
    }
  } catch (error) {
    console.error('Failed to fetch KTC fallback values:', error);
  }

  return {};
}

const KNOWN_BACKUP_QBS = [
  'joe milton', 'joe milton iii', 'trey lance', 'sam howell', 'tyler huntley',
  'jake browning', 'easton stick', 'cooper rush', 'taylor heinicke',
  'jarrett stidham', 'mitch trubisky', 'tyson bagent', 'joshua dobbs',
  'clayton tune', 'davis mills', 'aidan oconnell', 'jaren hall',
  'stetson bennett', 'dorian thompson-robinson', 'malik willis'
];

function calculateAdjustedValue(
  baseValue: number,
  playerData: any,
  position: string,
  rawValue: number,
  allRawValues: number[]
): { adjustedValue: number; trend: 'up' | 'down' | 'stable' } {
  let value = baseValue;
  let trend: 'up' | 'down' | 'stable' = 'stable';

  if (position === 'QB') {
    const qbValues = allRawValues.filter(v => v > 0).sort((a, b) => b - a);
    const topQBValue = qbValues[0] || 1;
    const medianQBValue = qbValues[Math.floor(qbValues.length / 2)] || 1;
    const relativeValue = rawValue / topQBValue;

    const playerNameLower = (playerData.full_name || '').toLowerCase();
    const isKnownBackup = KNOWN_BACKUP_QBS.some(name => playerNameLower.includes(name));

    if (isKnownBackup || relativeValue < 0.05) {
      value *= 0.02;
      trend = 'down';
    } else if (relativeValue < 0.10) {
      value *= 0.05;
      trend = 'down';
    } else if (relativeValue < 0.20) {
      value *= 0.15;
      trend = 'down';
    } else if (rawValue < medianQBValue * 0.30) {
      value *= 0.25;
      trend = 'down';
    }
  }

  // Apply rookie penalty for non-elite rookies (non-QBs)
  const yearsExp = playerData.years_exp || 0;
  if (yearsExp === 0 && position !== 'QB') {
    const allValues = allRawValues.filter(v => v > 0).sort((a, b) => b - a);
    const topValue = allValues[0] || 1;
    const relativeValue = rawValue / topValue;

    // If rookie is not in top 20% of all players, apply penalty
    if (relativeValue < 0.20) {
      value *= 0.85;
      if (trend === 'stable') trend = 'down';
    }
  }

  if (playerData.injury_status) {
    const injuryMultipliers: Record<string, number> = {
      'Out': 0.70,
      'Doubtful': 0.85,
      'Questionable': 0.95,
      'IR': 0.50,
      'PUP': 0.60,
      'COV': 0.40,
      'Sus': 0.30,
    };
    const multiplier = injuryMultipliers[playerData.injury_status] || 1;
    if (multiplier < 1) {
      value *= multiplier;
      trend = 'down';
    }
  }

  if (playerData.status === 'Inactive' || playerData.status === 'Retired') {
    value *= 0.10;
    trend = 'down';
  }

  const age = playerData.age || 0;
  if (age > 0) {
    if (position === 'RB') {
      if (age >= 30) value *= 0.75;
      else if (age >= 28) value *= 0.85;
      else if (age <= 23) value *= 1.10;
    } else if (position === 'WR') {
      if (age >= 32) value *= 0.80;
      else if (age >= 30) value *= 0.90;
      else if (age <= 24) value *= 1.05;
    } else if (position === 'TE') {
      if (age >= 32) value *= 0.85;
      else if (age <= 24) value *= 1.05;
    } else if (position === 'QB') {
      if (age >= 38) value *= 0.80;
      else if (age >= 35) value *= 0.90;
      else if (age >= 27 && age <= 32) value *= 1.05;
    }
  }

  return { adjustedValue: Math.max(0, value), trend };
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
    const positionGroups: Record<string, any[]> = { QB: [], RB: [], WR: [], TE: [] };

    const qbRawValues: number[] = [];
    Object.entries(sleeperPlayers).forEach(([playerId, playerData]: [string, any]) => {
      if (playerData.position === 'QB') {
        const fdpData = fdpValues[playerId];
        if (fdpData && fdpData.value > 0) {
          qbRawValues.push(fdpData.value);
        }
      }
    });

    Object.entries(sleeperPlayers).forEach(([playerId, playerData]: [string, any]) => {
      if (!playerData.position || !['QB', 'RB', 'WR', 'TE'].includes(playerData.position)) {
        return;
      }

      const fdpData = fdpValues[playerId];
      if (!fdpData || fdpData.value === 0) return;

      const { adjustedValue, trend } = calculateAdjustedValue(
        fdpData.value,
        playerData,
        playerData.position,
        fdpData.value,
        qbRawValues
      );

      // Check if backup QB or rookie penalty was applied
      const playerNameLower = (playerData.full_name || '').toLowerCase();
      const isKnownBackup = KNOWN_BACKUP_QBS.some(name => playerNameLower.includes(name));
      const isRookie = (playerData.years_exp || 0) === 0;

      const playerValue = {
        player_id: playerId,
        player_name: playerData.full_name || `${playerData.first_name} ${playerData.last_name}`,
        position: playerData.position,
        team: playerData.team || null,
        format: isSuperflex ? 'superflex' : 'standard',
        base_value: parseFloat((adjustedValue * 0.95).toFixed(0)),
        adjusted_value: parseFloat(adjustedValue.toFixed(0)),
        market_value: parseFloat(adjustedValue.toFixed(0)),
        source: 'fantasy_draft_pros',
        confidence_score: 0.85,
        updated_at: new Date().toISOString(),
        metadata: {
          trend: trend,
          is_superflex: isSuperflex,
          sleeper_status: playerData.status,
          injury_status: playerData.injury_status?.toLowerCase() || null,
          age: playerData.age || null,
          years_experience: playerData.years_exp || null,
          original_fdp_value: fdpData.value,
          backup_qb_applied: playerData.position === 'QB' && isKnownBackup,
          rookie_penalty_applied: isRookie && playerData.position !== 'QB',
        },
      };

      positionGroups[playerData.position].push(playerValue);
    });

    ['QB', 'RB', 'WR', 'TE'].forEach((position) => {
      const group = positionGroups[position];
      if (group.length === 0) return;

      group.sort((a, b) => b.adjusted_value - a.adjusted_value);

      const positionMultipliers: Record<string, number> = {
        QB: isSuperflex ? 1.0 : 0.75,
        RB: 1.0,
        WR: 0.95,
        TE: 0.85,
      };

      const multiplier = positionMultipliers[position] || 1.0;

      group.forEach((player, index) => {
        const tierBonus = index < 5 ? 1.15 : index < 12 ? 1.1 : index < 24 ? 1.05 : 1.0;
        player.adjusted_value = parseFloat((player.adjusted_value * multiplier * tierBonus).toFixed(0));
        player.market_value = player.adjusted_value;
        player.base_value = parseFloat((player.adjusted_value * 0.95).toFixed(0));
        player.rank_position = index + 1;
        playerValues.push(player);
      });
    });

    // Calculate overall rankings
    playerValues.sort((a, b) => b.adjusted_value - a.adjusted_value);
    playerValues.forEach((player, index) => {
      player.rank_overall = index + 1;
    });

    if (playerValues.length > 0) {
      const { error } = await supabase
        .from('latest_player_values')
        .upsert(playerValues, { onConflict: 'player_id' });

      if (error) {
        console.error('Error upserting player values:', error);
        throw error;
      }

      const topPlayers = playerValues
        .sort((a, b) => b.adjusted_value - a.adjusted_value)
        .slice(0, 10)
        .map(p => `${p.player_name} (${p.position}): ${p.adjusted_value}`);

      console.log(`Successfully synced ${playerValues.length} player values to database`);
      console.log('Top 10 player values:', topPlayers);

      return playerValues.length;
    }

    return 0;
  } catch (error) {
    console.error('Error syncing player values:', error);
    return 0;
  }
}

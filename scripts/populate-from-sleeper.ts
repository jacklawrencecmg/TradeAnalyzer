/**
 * Populate Player Values from Sleeper
 * Uses position-based baseline values
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  fantasy_positions?: string[];
  team?: string | null;
  status?: string;
  age?: number;
  years_exp?: number;
  depth_chart_order?: number;
  injury_status?: string;
}

// Position baseline values (scaled 0-10000)
const POSITION_BASELINES = {
  QB: { elite: 9000, starter: 6000, backup: 2000, rookie: 4000 },
  RB: { elite: 8500, starter: 5500, backup: 1800, rookie: 3500 },
  WR: { elite: 8800, starter: 5800, backup: 2000, rookie: 3800 },
  TE: { elite: 8000, starter: 5000, backup: 1500, rookie: 3000 },
};

function calculateValue(player: SleeperPlayer): number {
  const position = player.fantasy_positions?.[0] || player.position;
  if (!position || !['QB', 'RB', 'WR', 'TE'].includes(position)) return 0;

  const baseline = POSITION_BASELINES[position as keyof typeof POSITION_BASELINES];
  const yearsExp = player.years_exp || 0;
  const depth = player.depth_chart_order || 99;
  const age = player.age || 25;

  let value = baseline.starter;

  // Adjust by depth chart
  if (depth === 1 || depth === 2) {
    value = baseline.elite - (depth - 1) * 1000;
  } else if (depth <= 5) {
    value = baseline.starter - (depth - 3) * 800;
  } else {
    value = baseline.backup;
  }

  // Rookie boost
  if (yearsExp === 0 && depth <= 3) {
    value = Math.max(value, baseline.rookie);
  }

  // Age adjustment
  if (position === 'RB') {
    if (age >= 29) value *= 0.7;
    else if (age >= 27) value *= 0.85;
    else if (age <= 23) value *= 1.1;
  } else if (position === 'WR') {
    if (age >= 32) value *= 0.75;
    else if (age >= 30) value *= 0.9;
    else if (age <= 24) value *= 1.05;
  } else if (position === 'QB') {
    if (age >= 38) value *= 0.8;
    else if (age >= 36) value *= 0.9;
    else if (age >= 27 && age <= 32) value *= 1.05;
  }

  // Status adjustment
  if (player.status === 'Inactive' || player.status === 'Retired') {
    value *= 0.1;
  } else if (player.injury_status === 'IR' || player.injury_status === 'Out') {
    value *= 0.6;
  } else if (player.injury_status === 'Questionable') {
    value *= 0.95;
  }

  // Add some variation based on player_id hash (deterministic randomness)
  const hash = player.player_id.charCodeAt(0) % 20;
  value = value * (1 + (hash - 10) / 100);

  return Math.round(Math.max(0, Math.min(10000, value)));
}

async function main() {
  console.log('Starting player values population from Sleeper...\n');

  // Get active epoch
  const { data: epoch } = await supabase
    .from('value_epochs')
    .select('id')
    .eq('status', 'active')
    .single();

  if (!epoch) {
    console.error('No active value epoch found!');
    return;
  }

  console.log(`Active epoch: ${epoch.id}\n`);

  // Fetch Sleeper players
  console.log('Fetching Sleeper NFL players...');
  const response = await fetch('https://api.sleeper.app/v1/players/nfl');
  const playersObj: Record<string, SleeperPlayer> = await response.json();
  const allPlayers = Object.values(playersObj);

  console.log(`Total Sleeper players: ${allPlayers.length}\n`);

  // Filter to fantasy-relevant players
  const fantasyPositions = ['QB', 'RB', 'WR', 'TE'];
  const fantasyPlayers = allPlayers.filter(p => {
    const pos = p.fantasy_positions?.[0] || p.position;
    const isFantasyPos = pos && fantasyPositions.includes(pos);
    const isActive = !p.status || ['Active', 'IR', 'PUP', 'Questionable'].includes(p.status);
    return isFantasyPos && isActive;
  });

  console.log(`Fantasy-relevant players: ${fantasyPlayers.length}\n`);

  // Calculate values
  const playersWithValues = fantasyPlayers.map(player => {
    const position = player.fantasy_positions?.[0] || player.position;
    const fullName = player.full_name || `${player.first_name} ${player.last_name}`;
    const value = calculateValue(player);

    return {
      player,
      position,
      fullName,
      value,
    };
  }).filter(p => p.value > 0);

  // Sort by value
  playersWithValues.sort((a, b) => b.value - a.value);

  // Take top 1000
  const top1000 = playersWithValues.slice(0, 1000);

  console.log(`Preparing ${top1000.length} players for insertion...\n`);

  // Add ranks
  const byPosition: Record<string, any[]> = {};
  const valuesToInsert = top1000.map((p, idx) => {
    if (!byPosition[p.position]) byPosition[p.position] = [];
    const posRank = byPosition[p.position].length + 1;
    byPosition[p.position].push(p);

    return {
      player_id: p.player.player_id,
      player_name: p.fullName,
      position: p.position,
      team: p.player.team || null,
      format: 'dynasty',
      base_value: p.value,
      adjusted_value: p.value,
      market_value: p.value,
      rank_overall: idx + 1,
      rank_position: posRank,
      value_epoch_id: epoch.id,
      source: 'calculated',
      confidence_score: 0.75,
      metadata: {
        sleeper_status: p.player.status,
        years_exp: p.player.years_exp,
        age: p.player.age,
        depth_chart_order: p.player.depth_chart_order,
        injury_status: p.player.injury_status,
      },
      updated_at: new Date().toISOString(),
    };
  });

  console.log('Position breakdown:');
  Object.entries(byPosition).forEach(([pos, players]) => {
    console.log(`  ${pos}: ${players.length} players`);
  });
  console.log('');

  // Insert in batches
  console.log('Inserting values...');
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < valuesToInsert.length; i += batchSize) {
    const batch = valuesToInsert.slice(i, i + batchSize);
    const { error } = await supabase
      .from('player_values_canonical')
      .upsert(batch, {
        onConflict: 'player_id,league_profile_id,format,value_epoch_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`\nError inserting batch ${i}-${i + batchSize}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\rInserted ${inserted}/${valuesToInsert.length} players...`);
    }
  }

  console.log('\n\nDone!\n');

  // Verify
  const { count } = await supabase
    .from('latest_player_values')
    .select('*', { count: 'exact', head: true });

  console.log(`Total players in latest_player_values: ${count}\n`);

  // Show top 20
  const { data: top20 } = await supabase
    .from('latest_player_values')
    .select('player_name, position, adjusted_value, rank_overall')
    .order('rank_overall', { ascending: true })
    .limit(20);

  console.log('Top 20 players:');
  top20?.forEach(p => {
    console.log(`${p.rank_overall}. ${p.player_name} (${p.position}) - ${p.adjusted_value}`);
  });
}

main().catch(console.error);

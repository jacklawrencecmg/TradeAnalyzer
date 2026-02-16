/**
 * Populate Player Values Script
 *
 * This script syncs Sleeper players and populates the player values table
 * Run with: npx tsx scripts/populate-player-values.ts
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
}

function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '');
}

async function fetchSleeperPlayers(): Promise<SleeperPlayer[]> {
  console.log('Fetching Sleeper NFL players...');
  const response = await fetch('https://api.sleeper.app/v1/players/nfl');
  const playersObj: Record<string, SleeperPlayer> = await response.json();
  return Object.values(playersObj);
}

async function fetchFDPValues(): Promise<Record<string, number>> {
  console.log('Fetching FDP values...');
  const currentYear = new Date().getFullYear();
  const targetYear = new Date().getMonth() >= 8 ? currentYear + 1 : currentYear;

  try {
    const response = await fetch(
      `https://api.fantasydraftprospects.com/api/values/${targetYear}?format=2`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const values: Record<string, number> = {};
      data.forEach((item: any) => {
        if (item.sleeperId && item.value) {
          values[item.sleeperId] = parseInt(item.value, 10);
        }
      });
      console.log(`Fetched ${Object.keys(values).length} FDP values`);
      return values;
    }
  } catch (error) {
    console.error('FDP fetch failed:', error);
  }

  // Fallback to KTC
  try {
    console.log('Trying KTC fallback...');
    const response = await fetch(
      'https://api.keeptradecut.com/bff/dynasty/players?format=2',
      { headers: { 'Accept': 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const values: Record<string, number> = {};
      data.forEach((item: any) => {
        if (item.sleeperId && item.value) {
          values[item.sleeperId] = parseInt(item.value, 10);
        }
      });
      console.log(`Fetched ${Object.keys(values).length} KTC values`);
      return values;
    }
  } catch (error) {
    console.error('KTC fetch failed:', error);
  }

  return {};
}

async function main() {
  console.log('Starting player values population...\n');

  // Step 1: Get active epoch
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

  // Step 2: Fetch Sleeper players
  const sleeperPlayers = await fetchSleeperPlayers();
  console.log(`Total Sleeper players: ${sleeperPlayers.length}\n`);

  // Step 3: Fetch value data
  const fdpValues = await fetchFDPValues();

  // Step 4: Filter to fantasy-relevant players with values
  const fantasyPositions = ['QB', 'RB', 'WR', 'TE'];
  const playersWithValues = sleeperPlayers.filter(p => {
    const pos = p.fantasy_positions?.[0] || p.position;
    return pos && fantasyPositions.includes(pos) && fdpValues[p.player_id];
  });

  console.log(`Players with values: ${playersWithValues.length}\n`);

  // Step 5: Prepare values for insertion
  const valuesToInsert = playersWithValues.map(player => {
    const position = player.fantasy_positions?.[0] || player.position;
    const fullName = player.full_name || `${player.first_name} ${player.last_name}`;
    const rawValue = fdpValues[player.player_id];

    return {
      player_id: player.player_id,
      player_name: fullName,
      position: position,
      team: player.team || null,
      format: 'dynasty',
      base_value: rawValue,
      adjusted_value: rawValue,
      market_value: rawValue,
      value_epoch_id: epoch.id,
      source: 'fantasy_draft_pros',
      confidence_score: 0.85,
      metadata: {
        sleeper_status: player.status,
        years_exp: player.years_exp,
        age: player.age,
      },
      updated_at: new Date().toISOString(),
    };
  });

  // Sort by value
  valuesToInsert.sort((a, b) => b.adjusted_value - a.adjusted_value);

  // Add overall and position ranks
  const byPosition: Record<string, any[]> = {};
  valuesToInsert.forEach((p, idx) => {
    p['rank_overall'] = idx + 1;
    if (!byPosition[p.position]) byPosition[p.position] = [];
    byPosition[p.position].push(p);
  });

  Object.values(byPosition).forEach(posGroup => {
    posGroup.forEach((p, idx) => {
      p.rank_position = idx + 1;
    });
  });

  // Take top 1000
  const top1000 = valuesToInsert.slice(0, 1000);

  console.log('Inserting values...');

  // Insert in batches
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < top1000.length; i += batchSize) {
    const batch = top1000.slice(i, i + batchSize);
    const { error } = await supabase
      .from('player_values_canonical')
      .upsert(batch, {
        onConflict: 'player_id,league_profile_id,format,value_epoch_id'
      });

    if (error) {
      console.error(`Error inserting batch ${i}-${i + batchSize}:`, error);
    } else {
      inserted += batch.length;
      process.stdout.write(`\rInserted ${inserted}/${top1000.length} players...`);
    }
  }

  console.log('\n\nDone!');

  // Verify
  const { count } = await supabase
    .from('latest_player_values')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal players in latest_player_values: ${count}`);

  // Show top 10
  const { data: top10 } = await supabase
    .from('latest_player_values')
    .select('player_name, position, adjusted_value, rank_overall')
    .order('rank_overall', { ascending: true })
    .limit(10);

  console.log('\nTop 10 players:');
  top10?.forEach(p => {
    console.log(`${p.rank_overall}. ${p.player_name} (${p.position}) - ${p.adjusted_value}`);
  });
}

main().catch(console.error);

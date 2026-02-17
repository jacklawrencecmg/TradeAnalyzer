import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PlayerIdentity {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  sleeper_id: string | null;
  espn_id: string | null;
  gsis_id: string | null;
  headshot_url: string | null;
}

const DEFAULT_SILHOUETTE = 'https://sleepercdn.com/images/v2/icons/player_default.webp';

function buildSleeperHeadshot(sleeperId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;
}

function buildEspnHeadshot(espnId: string): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=350&h=254`;
}

function buildGsisHeadshot(gsisId: string): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${gsisId}.png&w=350&h=254`;
}

async function verifyImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveHeadshotUrl(player: PlayerIdentity): Promise<{
  url: string;
  source: 'sleeper' | 'espn' | 'gsis' | 'manual' | 'fallback';
  confidence: number;
}> {
  if (player.sleeper_id) {
    const url = buildSleeperHeadshot(player.sleeper_id);
    const valid = await verifyImageUrl(url);
    if (valid) {
      return { url, source: 'sleeper', confidence: 95 };
    }
  }

  if (player.espn_id) {
    const url = buildEspnHeadshot(player.espn_id);
    const valid = await verifyImageUrl(url);
    if (valid) {
      return { url, source: 'espn', confidence: 85 };
    }
  }

  if (player.gsis_id) {
    const url = buildGsisHeadshot(player.gsis_id);
    const valid = await verifyImageUrl(url);
    if (valid) {
      return { url, source: 'gsis', confidence: 80 };
    }
  }

  if (player.headshot_url && player.headshot_url !== DEFAULT_SILHOUETTE) {
    const valid = await verifyImageUrl(player.headshot_url);
    if (valid) {
      return { url: player.headshot_url, source: 'manual', confidence: 70 };
    }
  }

  return { url: DEFAULT_SILHOUETTE, source: 'fallback', confidence: 0 };
}

async function getAllRankedPlayers(): Promise<PlayerIdentity[]> {
  console.log('📊 Fetching all ranked players...');

  const { data: rankedPlayers, error } = await supabase
    .from('ktc_value_snapshots')
    .select('player_id')
    .not('player_id', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch ranked players: ${error.message}`);
  }

  const uniquePlayerIds = [...new Set(rankedPlayers.map(p => p.player_id))];
  console.log(`✅ Found ${uniquePlayerIds.length} unique ranked players`);

  const { data: players, error: identityError } = await supabase
    .from('player_identity')
    .select('player_id, full_name, position, team, sleeper_id, espn_id, gsis_id, headshot_url')
    .in('player_id', uniquePlayerIds);

  if (identityError) {
    throw new Error(`Failed to fetch player identities: ${identityError.message}`);
  }

  console.log(`✅ Loaded ${players.length} player identities`);
  return players;
}

async function detectDuplicates(): Promise<void> {
  console.log('\n🔍 Checking for duplicate headshots...');

  const { data: duplicates, error } = await supabase
    .from('player_headshot_duplicates')
    .select('*');

  if (error) {
    console.error('⚠️  Error checking duplicates:', error.message);
    return;
  }

  if (!duplicates || duplicates.length === 0) {
    console.log('✅ No duplicate headshots found');
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate headshots:`);
  for (const dup of duplicates) {
    console.log(`  - ${dup.headshot_url}`);
    console.log(`    Used by ${dup.player_count} players: ${dup.player_ids.join(', ')}`);
    console.log(`    Sources: ${dup.sources.join(', ')}`);
    console.log(`    Min confidence: ${dup.min_confidence}`);
  }
}

async function repairHeadshots(dryRun = false): Promise<void> {
  console.log('\n🔧 Starting headshot repair...');
  if (dryRun) {
    console.log('📝 DRY RUN MODE - No changes will be made\n');
  }

  const players = await getAllRankedPlayers();

  let processed = 0;
  let resolved = 0;
  let failed = 0;
  let skipped = 0;

  for (const player of players) {
    processed++;

    const { data: existing } = await supabase
      .from('player_headshots')
      .select('is_override, headshot_url, source, confidence')
      .eq('player_id', player.player_id)
      .eq('is_override', true)
      .maybeSingle();

    if (existing) {
      skipped++;
      if (processed % 100 === 0) {
        console.log(`[${processed}/${players.length}] Skipped ${player.full_name} (manual override)`);
      }
      continue;
    }

    const result = await resolveHeadshotUrl(player);

    if (result.source === 'fallback') {
      failed++;
      console.log(`⚠️  [${processed}/${players.length}] ${player.full_name} (${player.position}) - No valid headshot found`);
      console.log(`    IDs: Sleeper=${player.sleeper_id || 'none'}, ESPN=${player.espn_id || 'none'}, GSIS=${player.gsis_id || 'none'}`);
    } else {
      resolved++;
      if (processed % 100 === 0) {
        console.log(`✅ [${processed}/${players.length}] ${player.full_name} - ${result.source} (${result.confidence})`);
      }
    }

    if (!dryRun) {
      const { error: upsertError } = await supabase
        .from('player_headshots')
        .upsert({
          player_id: player.player_id,
          headshot_url: result.url,
          source: result.source,
          confidence: result.confidence,
          is_override: false,
          verified_at: new Date().toISOString(),
        }, {
          onConflict: 'player_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`❌ Failed to upsert ${player.full_name}:`, upsertError.message);
      }
    }

    if (processed % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n📊 Repair Summary:');
  console.log(`  Total processed: ${processed}`);
  console.log(`  ✅ Resolved: ${resolved} (${((resolved/processed)*100).toFixed(1)}%)`);
  console.log(`  ⚠️  Failed (fallback): ${failed} (${((failed/processed)*100).toFixed(1)}%)`);
  console.log(`  🔒 Skipped (override): ${skipped}`);

  await detectDuplicates();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🎯 Player Headshot Repair Tool\n');

  try {
    await repairHeadshots(dryRun);
    console.log('\n✅ Headshot repair completed!');
  } catch (error) {
    console.error('\n❌ Error during repair:', error);
    process.exit(1);
  }
}

main();

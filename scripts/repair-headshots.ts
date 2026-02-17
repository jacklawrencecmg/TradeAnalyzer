import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function repairHeadshots() {
  console.log('Starting headshot repair process...\n');

  console.log('Step 1: Getting current headshot statistics...');
  const { data: statsBefore, error: statsError } = await supabase.rpc('get_headshot_stats');

  if (statsError) {
    console.error('Error getting stats:', statsError);
    process.exit(1);
  }

  if (statsBefore && statsBefore[0]) {
    const stats = statsBefore[0];
    console.log(`Current state:`);
    console.log(`  Total players: ${stats.total_players}`);
    console.log(`  With headshot: ${stats.with_headshot}`);
    console.log(`  Missing headshot: ${stats.missing_headshot}`);
    console.log(`  Verified headshot: ${stats.verified_headshot}`);
    console.log(`  Percent complete: ${stats.percent_complete}%\n`);
  }

  console.log('Step 2: Detecting duplicate headshots...');
  const { data: duplicates, error: duplicatesError } = await supabase.rpc(
    'detect_duplicate_headshots'
  );

  if (duplicatesError) {
    console.error('Error detecting duplicates:', duplicatesError);
  } else if (duplicates && duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate headshots:`);
    duplicates.slice(0, 5).forEach((dup) => {
      console.log(`  ${dup.headshot_url}`);
      console.log(`    Used by ${dup.player_count} players: ${dup.player_names.join(', ')}`);
    });
    console.log();

    console.log('Clearing duplicate headshots...');
    for (const dup of duplicates) {
      await supabase
        .from('player_identity')
        .update({
          headshot_url: null,
          headshot_source: null,
          headshot_updated_at: null,
          headshot_verified: false,
        })
        .eq('headshot_url', dup.headshot_url);
    }
    console.log('Cleared duplicate headshots\n');
  } else {
    console.log('No duplicate headshots found\n');
  }

  console.log('Step 3: Clearing non-verified headshots for re-sync...');
  const { error: clearError } = await supabase
    .from('player_identity')
    .update({
      headshot_url: null,
      headshot_source: null,
      headshot_updated_at: null,
    })
    .eq('headshot_verified', false)
    .not('headshot_url', 'is', null);

  if (clearError) {
    console.error('Error clearing headshots:', clearError);
  } else {
    console.log('Cleared non-verified headshots\n');
  }

  console.log('Step 4: Syncing headshots from Sleeper...');
  const syncUrl = `${supabaseUrl}/functions/v1/sync-player-headshots?force=false`;

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log(`Sync result: ${result.message}`);
    console.log(`  Synced: ${result.synced}`);
    console.log(`  Skipped: ${result.skipped}`);
    console.log(`  Errors: ${result.errors}\n`);
  } catch (error) {
    console.error('Error calling sync function:', error);
  }

  console.log('Step 5: Syncing missing headshots with fallback providers...');
  const missingSyncUrl = `${supabaseUrl}/functions/v1/sync-player-headshots?missing_only=true`;

  try {
    const response = await fetch(missingSyncUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log(`Missing sync result: ${result.message}`);
    console.log(`  Synced: ${result.synced}\n`);
  } catch (error) {
    console.error('Error calling missing sync function:', error);
  }

  console.log('Step 6: Getting final headshot statistics...');
  const { data: statsAfter, error: statsAfterError } = await supabase.rpc('get_headshot_stats');

  if (statsAfterError) {
    console.error('Error getting final stats:', statsAfterError);
  } else if (statsAfter && statsAfter[0]) {
    const stats = statsAfter[0];
    console.log(`Final state:`);
    console.log(`  Total players: ${stats.total_players}`);
    console.log(`  With headshot: ${stats.with_headshot}`);
    console.log(`  Missing headshot: ${stats.missing_headshot}`);
    console.log(`  Verified headshot: ${stats.verified_headshot}`);
    console.log(`  Percent complete: ${stats.percent_complete}%\n`);

    const improvement =
      statsBefore && statsBefore[0]
        ? stats.percent_complete - statsBefore[0].percent_complete
        : 0;

    if (improvement > 0) {
      console.log(`Improvement: +${improvement.toFixed(2)}%`);
    }
  }

  console.log('\nHeadshot repair process complete!');
}

repairHeadshots().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

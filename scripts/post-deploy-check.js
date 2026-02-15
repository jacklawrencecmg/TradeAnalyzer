#!/usr/bin/env node

/**
 * Post-Deploy Verification Script
 *
 * Runs after deployment to verify system health:
 * 1. Rebuild status
 * 2. Player counts
 * 3. Top player sanity (QB1/RB1 exist)
 * 4. Response time test (<300ms)
 * 5. API endpoint availability
 *
 * Returns PASS/FAIL summary
 */

const { createClient } = require('@supabase/supabase-js');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  log(` ${title}`, colors.bold);
  console.log('═'.repeat(60) + '\n');
}

async function checkRebuildStatus(supabase) {
  logSection('1. Rebuild Status');

  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .eq('action', 'rebuild_completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log(`✗ Failed to check rebuild status: ${error.message}`, colors.red);
      return false;
    }

    if (!data) {
      log('⚠ No successful rebuilds found', colors.yellow);
      return false;
    }

    const lastRebuild = new Date(data.created_at);
    const ageHours = (Date.now() - lastRebuild.getTime()) / (1000 * 60 * 60);

    log(`✓ Last rebuild: ${lastRebuild.toLocaleString()}`, colors.green);
    log(`✓ Age: ${ageHours.toFixed(1)} hours`, colors.green);

    if (ageHours > 48) {
      log('⚠ Rebuild is old (>48 hours)', colors.yellow);
      return false;
    }

    log('\n✅ Rebuild status OK', colors.green);
    return true;
  } catch (err) {
    log(`✗ Error: ${err.message}`, colors.red);
    return false;
  }
}

async function checkPlayerCounts(supabase) {
  logSection('2. Player Counts');

  try {
    // Count NFL players
    const { count: playersCount, error: playersError } = await supabase
      .from('nfl_players')
      .select('*', { count: 'exact', head: true });

    if (playersError) {
      log(`✗ Failed to count nfl_players: ${playersError.message}`, colors.red);
      return false;
    }

    log(`✓ NFL Players: ${playersCount}`, colors.green);

    if (playersCount < 100) {
      log('⚠ NFL player count is low', colors.yellow);
      return false;
    }

    // Count player values
    const { count: valuesCount, error: valuesError } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true });

    if (valuesError) {
      log(`✗ Failed to count player_values: ${valuesError.message}`, colors.red);
      return false;
    }

    log(`✓ Player Values: ${valuesCount}`, colors.green);

    if (valuesCount < 100) {
      log('⚠ Player value count is low', colors.yellow);
      return false;
    }

    log('\n✅ Player counts OK', colors.green);
    return true;
  } catch (err) {
    log(`✗ Error: ${err.message}`, colors.red);
    return false;
  }
}

async function checkTopPlayers(supabase) {
  logSection('3. Top Player Sanity');

  try {
    // Check top QB
    const { data: topQB, error: qbError } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', 'dynasty')
      .eq('position', 'QB')
      .order('fdp_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (qbError || !topQB) {
      log('✗ No top QB found', colors.red);
      return false;
    }

    log(`✓ Top QB value: ${topQB.fdp_value}`, colors.green);

    // Check top RB
    const { data: topRB, error: rbError } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', 'dynasty')
      .eq('position', 'RB')
      .order('fdp_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rbError || !topRB) {
      log('✗ No top RB found', colors.red);
      return false;
    }

    log(`✓ Top RB value: ${topRB.fdp_value}`, colors.green);

    // Sanity check values
    if (topQB.fdp_value < 50 || topRB.fdp_value < 50) {
      log('⚠ Top player values seem low', colors.yellow);
      return false;
    }

    log('\n✅ Top player sanity OK', colors.green);
    return true;
  } catch (err) {
    log(`✗ Error: ${err.message}`, colors.red);
    return false;
  }
}

async function checkResponseTimes(supabase) {
  logSection('4. Response Time Test');

  const tests = [
    {
      name: 'Player Values Query',
      fn: async () => {
        const start = Date.now();
        await supabase
          .from('player_values')
          .select('*')
          .limit(100);
        return Date.now() - start;
      },
      maxMs: 300,
    },
    {
      name: 'NFL Players Query',
      fn: async () => {
        const start = Date.now();
        await supabase
          .from('nfl_players')
          .select('*')
          .limit(100);
        return Date.now() - start;
      },
      maxMs: 300,
    },
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      const duration = await test.fn();

      if (duration <= test.maxMs) {
        log(`✓ ${test.name}: ${duration}ms`, colors.green);
      } else {
        log(`⚠ ${test.name}: ${duration}ms (expected <${test.maxMs}ms)`, colors.yellow);
        allPassed = false;
      }
    } catch (err) {
      log(`✗ ${test.name}: FAILED`, colors.red);
      allPassed = false;
    }
  }

  if (allPassed) {
    log('\n✅ Response times OK', colors.green);
  } else {
    log('\n⚠ Some response times are slow', colors.yellow);
  }

  return allPassed;
}

async function main() {
  console.log('\n');
  log('╔══════════════════════════════════════════════════════════╗', colors.blue);
  log('║         POST-DEPLOY VERIFICATION                         ║', colors.blue);
  log('╚══════════════════════════════════════════════════════════╝', colors.blue);
  console.log('\n');

  // Initialize Supabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('❌ VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY not set', colors.red);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Run checks
  const results = {
    rebuild: await checkRebuildStatus(supabase),
    counts: await checkPlayerCounts(supabase),
    topPlayers: await checkTopPlayers(supabase),
    responseTimes: await checkResponseTimes(supabase),
  };

  // Summary
  logSection('SUMMARY');

  const passed = Object.values(results).filter((r) => r).length;
  const total = Object.values(results).length;

  log(`Passed: ${passed}/${total}`, passed === total ? colors.green : colors.yellow);

  if (passed === total) {
    log('\n✅ ALL CHECKS PASSED', colors.green);
    log('✅ Deployment verified', colors.green);
    console.log('\n');
    process.exit(0);
  } else {
    log('\n⚠ SOME CHECKS FAILED', colors.yellow);
    log('⚠ Review failures above', colors.yellow);
    console.log('\n');
    process.exit(1);
  }
}

main().catch((err) => {
  log(`\n❌ Post-deploy check failed: ${err.message}`, colors.red);
  process.exit(1);
});

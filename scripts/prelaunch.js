#!/usr/bin/env node

/**
 * Pre-Launch Verification Script
 *
 * Runs comprehensive checks before deployment:
 * 1. Environment validation
 * 2. Database schema verification
 * 3. Value freshness check
 * 4. Performance smoke tests
 * 5. Health report generation
 *
 * Exit code 0 = Safe to deploy
 * Exit code 1 = Deployment blocked
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
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

// Initialize Supabase client
function initSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('❌ VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY not set', colors.red);
    process.exit(1);
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Check 1: Environment Variables
async function checkEnvironment() {
  logSection('1. Environment Variables');

  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_ADMIN_SYNC_SECRET',
    'VITE_CRON_SECRET',
  ];

  let allPresent = true;

  for (const varName of required) {
    if (process.env[varName]) {
      log(`✓ ${varName}`, colors.green);
    } else {
      log(`✗ ${varName} - MISSING`, colors.red);
      allPresent = false;
    }
  }

  if (!allPresent) {
    log('\n❌ Missing required environment variables', colors.red);
    return false;
  }

  log('\n✅ All environment variables present', colors.green);
  return true;
}

// Check 2: Database Schema
async function checkDatabaseSchema(supabase) {
  logSection('2. Database Schema');

  const requiredTables = [
    'nfl_players',
    'player_values_canonical',
    'value_epochs',
    'player_values_staging',
    'value_snapshots',
    'leagues',
    'league_profiles',
    'system_health_metrics',
    'model_config',
  ];

  let allExist = true;

  for (const table of requiredTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(0);

      if (error && error.code !== 'PGRST116') {
        log(`✗ ${table} - MISSING`, colors.red);
        allExist = false;
      } else {
        log(`✓ ${table}`, colors.green);
      }
    } catch (err) {
      log(`✗ ${table} - ERROR: ${err.message}`, colors.red);
      allExist = false;
    }
  }

  if (!allExist) {
    log('\n❌ Missing required database tables', colors.red);
    return false;
  }

  log('\n✅ All required tables exist', colors.green);
  return true;
}

// Check 3: Value Freshness & Epoch System
async function checkValueFreshness(supabase) {
  logSection('3. Value Freshness & Epoch System');

  try {
    // Check for active epoch
    const { data: currentEpoch, error: epochError } = await supabase.rpc('get_current_epoch');

    if (epochError || !currentEpoch) {
      log('✗ No active epoch found!', colors.red);
      log('  Run rebuild to create initial epoch', colors.yellow);
      return false;
    }

    log(`✓ Active epoch: ${currentEpoch}`, colors.green);

    // Get epoch info
    const { data: epochInfo } = await supabase
      .from('value_epochs')
      .select('*')
      .eq('id', currentEpoch)
      .single();

    if (epochInfo) {
      log(`✓ Epoch created: ${new Date(epochInfo.created_at).toLocaleString()}`, colors.green);
      log(`✓ Players processed: ${epochInfo.players_processed}`, colors.green);
    }

    // Check canonical values
    const { data, error } = await supabase
      .from('player_values_canonical')
      .select('format, updated_at, value_epoch_id')
      .eq('value_epoch_id', currentEpoch)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      log(`✗ Failed to query player_values_canonical: ${error.message}`, colors.red);
      return false;
    }

    if (!data || data.length === 0) {
      log('✗ No player values found in canonical table!', colors.red);
      log('  Run: supabase functions invoke rebuild-player-values-v2', colors.yellow);
      return false;
    }

    const dynastyCount = data.filter((v) => v.format === 'dynasty').length;
    const redraftCount = data.filter((v) => v.format === 'redraft').length;
    const bestballCount = data.filter((v) => v.format === 'bestball').length;

    log(`✓ Total values: ${data.length}`, colors.green);
    log(`✓ Dynasty: ${dynastyCount}`, colors.green);
    log(`✓ Redraft: ${redraftCount}`, colors.green);
    log(`✓ Bestball: ${bestballCount}`, colors.green);

    if (dynastyCount === 0) {
      log('✗ Missing dynasty values', colors.red);
      return false;
    }

    const mostRecent = new Date(data[0].updated_at);
    const ageHours = (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60);

    log(`✓ Last updated: ${mostRecent.toLocaleString()}`, colors.green);
    log(`✓ Age: ${ageHours.toFixed(1)} hours`, colors.green);

    if (ageHours > 48) {
      log('✗ Values are stale (>48 hours old)', colors.red);
      log('  Run: supabase functions invoke rebuild-player-values-v2', colors.yellow);
      return false;
    }

    if (ageHours > 36) {
      log('⚠ Values are getting old (>36 hours)', colors.yellow);
    }

    log('\n✅ Values are fresh and epoch system working', colors.green);
    return true;
  } catch (err) {
    log(`✗ Error checking value freshness: ${err.message}`, colors.red);
    return false;
  }
}

// Check 4: Performance Smoke Test
async function checkPerformance(supabase) {
  logSection('4. Performance Smoke Test');

  const tests = [
    {
      name: 'Rankings Query (Canonical)',
      fn: async () => {
        const start = Date.now();
        await supabase
          .from('player_values_canonical')
          .select('*')
          .eq('format', 'dynasty')
          .is('league_profile_id', null)
          .order('adjusted_value', { ascending: false })
          .limit(100);
        return Date.now() - start;
      },
      maxMs: 500,
    },
    {
      name: 'Player Detail Query',
      fn: async () => {
        const start = Date.now();
        await supabase
          .from('nfl_players')
          .select('*')
          .limit(1)
          .maybeSingle();
        return Date.now() - start;
      },
      maxMs: 200,
    },
    {
      name: 'Snapshot Query',
      fn: async () => {
        const start = Date.now();
        await supabase
          .from('value_snapshots')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
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
        log(`✓ ${test.name}: ${duration}ms (max ${test.maxMs}ms)`, colors.green);
      } else {
        log(`⚠ ${test.name}: ${duration}ms (expected <${test.maxMs}ms)`, colors.yellow);
      }
    } catch (err) {
      log(`✗ ${test.name}: FAILED - ${err.message}`, colors.red);
      allPassed = false;
    }
  }

  if (!allPassed) {
    log('\n⚠ Some performance tests failed', colors.yellow);
    return false;
  }

  log('\n✅ Performance tests passed', colors.green);
  return true;
}

// Check 5: Data Sanity
async function checkDataSanity(supabase) {
  logSection('5. Data Sanity Check');

  try {
    // Check top dynasty QB exists
    const { data: topQB } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', 'dynasty')
      .eq('position', 'QB')
      .order('fdp_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!topQB) {
      log('✗ No dynasty QB values found', colors.red);
      return false;
    }

    log(`✓ Top dynasty QB value: ${topQB.fdp_value}`, colors.green);

    if (topQB.fdp_value < 100) {
      log(`⚠ Top QB value seems low: ${topQB.fdp_value}`, colors.yellow);
    }

    // Check top dynasty RB exists
    const { data: topRB } = await supabase
      .from('player_values')
      .select('player_id, fdp_value')
      .eq('format', 'dynasty')
      .eq('position', 'RB')
      .order('fdp_value', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!topRB) {
      log('✗ No dynasty RB values found', colors.red);
      return false;
    }

    log(`✓ Top dynasty RB value: ${topRB.fdp_value}`, colors.green);

    log('\n✅ Data sanity check passed', colors.green);
    return true;
  } catch (err) {
    log(`✗ Data sanity check failed: ${err.message}`, colors.red);
    return false;
  }
}

// Main
async function main() {
  console.log('\n');
  log('╔══════════════════════════════════════════════════════════╗', colors.blue);
  log('║         PRE-LAUNCH VERIFICATION                          ║', colors.blue);
  log('╚══════════════════════════════════════════════════════════╝', colors.blue);
  console.log('\n');

  const results = {
    environment: false,
    schema: false,
    freshness: false,
    performance: false,
    sanity: false,
  };

  // Check environment
  results.environment = await checkEnvironment();
  if (!results.environment) {
    log('\n❌ DEPLOYMENT BLOCKED: Environment validation failed', colors.red);
    process.exit(1);
  }

  // Initialize Supabase
  const supabase = initSupabase();

  // Check schema
  results.schema = await checkDatabaseSchema(supabase);
  if (!results.schema) {
    log('\n❌ DEPLOYMENT BLOCKED: Database schema validation failed', colors.red);
    process.exit(1);
  }

  // Check value freshness
  results.freshness = await checkValueFreshness(supabase);
  if (!results.freshness) {
    log('\n❌ DEPLOYMENT BLOCKED: Value freshness check failed', colors.red);
    process.exit(1);
  }

  // Check performance
  results.performance = await checkPerformance(supabase);

  // Check data sanity
  results.sanity = await checkDataSanity(supabase);

  // Summary
  logSection('SUMMARY');

  const allCriticalPassed =
    results.environment && results.schema && results.freshness;

  if (allCriticalPassed) {
    log('✅ ALL CRITICAL CHECKS PASSED', colors.green);
    log('✅ Safe to deploy', colors.green);
    console.log('\n');
    process.exit(0);
  } else {
    log('❌ CRITICAL CHECKS FAILED', colors.red);
    log('❌ Deployment blocked', colors.red);
    console.log('\n');
    process.exit(1);
  }
}

// Run
main().catch((err) => {
  log(`\n❌ Pre-launch check failed: ${err.message}`, colors.red);
  process.exit(1);
});

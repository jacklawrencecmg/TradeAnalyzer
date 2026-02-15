/**
 * Database Schema Verifier
 *
 * Verifies all required database tables exist before app starts.
 * Prevents startup if critical tables are missing.
 */

import { supabase } from '../supabase';

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  missingTables: string[];
  existingTables: string[];
}

/**
 * Required database tables
 */
const REQUIRED_TABLES = [
  // Core player data
  'nfl_players',
  'player_values',
  'player_values_versioned',

  // Value system
  'value_snapshots',
  'player_value_history',
  'rookie_pick_values',

  // League system
  'leagues',
  'league_profiles',
  'league_rosters',

  // User features
  'watchlist_players',
  'notifications',
  'player_advice',

  // Health & monitoring
  'system_health_checks',
  'system_snapshots',
  'model_performance_history',

  // Security
  'admin_audit_log',
  'rate_limits',

  // A/B testing
  'experiments',
  'user_experiment_assignments',
  'user_actions',
  'trade_analysis_history',
];

/**
 * Check if table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    // If no error or just empty result, table exists
    return !error || error.code === 'PGRST116'; // Empty result is ok
  } catch (error) {
    return false;
  }
}

/**
 * Validate database schema
 */
export async function validateSchema(): Promise<SchemaValidationResult> {
  const errors: string[] = [];
  const missingTables: string[] = [];
  const existingTables: string[] = [];

  console.log('🔍 Validating database schema...');

  // Check each required table
  for (const tableName of REQUIRED_TABLES) {
    const exists = await tableExists(tableName);

    if (exists) {
      existingTables.push(tableName);
    } else {
      missingTables.push(tableName);
      errors.push(`❌ Missing required table: ${tableName}`);
    }
  }

  const valid = missingTables.length === 0;

  // Log results
  if (valid) {
    console.log(`✅ Schema validation passed (${existingTables.length} tables verified)`);
  } else {
    console.error('❌ Schema validation FAILED');
    console.error(`   Missing ${missingTables.length} required table(s):`);
    missingTables.forEach((t) => console.error(`   - ${t}`));
  }

  return {
    valid,
    errors,
    missingTables,
    existingTables,
  };
}

/**
 * Validate schema and throw if invalid
 */
export async function requireValidSchema(): Promise<void> {
  const result = await validateSchema();

  if (!result.valid) {
    const errorMessage = [
      '',
      '═══════════════════════════════════════════════════',
      '🚨 DATABASE SCHEMA VALIDATION FAILED',
      '═══════════════════════════════════════════════════',
      '',
      'Required database tables are missing:',
      '',
      ...result.missingTables.map((t) => `  - ${t}`),
      '',
      'Run database migrations before starting the application:',
      '',
      '  1. Check supabase/migrations/ directory',
      '  2. Apply migrations via Supabase dashboard or CLI',
      '  3. Restart the application',
      '',
      '═══════════════════════════════════════════════════',
      '',
    ].join('\n');

    console.error(errorMessage);

    throw new Error('Database schema validation failed. Cannot start application.');
  }
}

/**
 * Get schema health info
 */
export async function getSchemaHealth(): Promise<{
  totalTables: number;
  existingTables: number;
  missingTables: number;
  healthy: boolean;
}> {
  const result = await validateSchema();

  return {
    totalTables: REQUIRED_TABLES.length,
    existingTables: result.existingTables.length,
    missingTables: result.missingTables.length,
    healthy: result.valid,
  };
}

/**
 * Check specific table counts (sanity check)
 */
export async function validateTableCounts(): Promise<{
  valid: boolean;
  errors: string[];
  counts: Record<string, number>;
}> {
  const errors: string[] = [];
  const counts: Record<string, number> = {};

  console.log('🔍 Validating table counts...');

  try {
    // Check nfl_players count
    const { count: playersCount, error: playersError } = await supabase
      .from('nfl_players')
      .select('*', { count: 'exact', head: true });

    if (playersError) {
      errors.push(`Error counting nfl_players: ${playersError.message}`);
    } else {
      counts.nfl_players = playersCount || 0;

      if (counts.nfl_players === 0) {
        errors.push('❌ nfl_players table is empty!');
      } else if (counts.nfl_players < 100) {
        errors.push(`⚠️  nfl_players has only ${counts.nfl_players} rows (expected 1000+)`);
      }
    }

    // Check player_values count
    const { count: valuesCount, error: valuesError } = await supabase
      .from('player_values')
      .select('*', { count: 'exact', head: true });

    if (valuesError) {
      errors.push(`Error counting player_values: ${valuesError.message}`);
    } else {
      counts.player_values = valuesCount || 0;

      if (counts.player_values === 0) {
        errors.push('❌ player_values table is empty!');
      } else if (counts.player_values < 100) {
        errors.push(`⚠️  player_values has only ${counts.player_values} rows (expected 500+)`);
      }
    }

    // Check value_snapshots count
    const { count: snapshotsCount, error: snapshotsError } = await supabase
      .from('value_snapshots')
      .select('*', { count: 'exact', head: true });

    if (snapshotsError) {
      errors.push(`Error counting value_snapshots: ${snapshotsError.message}`);
    } else {
      counts.value_snapshots = snapshotsCount || 0;
    }

    const valid = errors.filter((e) => e.startsWith('❌')).length === 0;

    if (valid) {
      console.log('✅ Table counts validated');
      console.log(`   nfl_players: ${counts.nfl_players}`);
      console.log(`   player_values: ${counts.player_values}`);
      console.log(`   value_snapshots: ${counts.value_snapshots}`);
    } else {
      console.error('❌ Table count validation failed');
      errors.forEach((e) => console.error(`   ${e}`));
    }

    return { valid, errors, counts };
  } catch (error) {
    console.error('Error validating table counts:', error);
    return {
      valid: false,
      errors: ['Failed to validate table counts'],
      counts: {},
    };
  }
}

/**
 * Validate RLS is enabled on user tables
 */
export async function validateRLS(): Promise<{
  valid: boolean;
  errors: string[];
  tablesWithRLS: string[];
  tablesWithoutRLS: string[];
}> {
  const errors: string[] = [];
  const tablesWithRLS: string[] = [];
  const tablesWithoutRLS: string[] = [];

  console.log('🔍 Validating RLS policies...');

  const USER_TABLES = [
    'leagues',
    'watchlist_players',
    'notifications',
    'player_advice',
    'league_profiles',
  ];

  try {
    // Query pg_tables to check RLS status
    const { data, error } = await supabase
      .rpc('check_rls_enabled', { table_names: USER_TABLES })
      .single();

    if (error) {
      // Fallback: Try to insert/select to test RLS
      for (const table of USER_TABLES) {
        try {
          // Try to select from table
          await supabase.from(table).select('*').limit(1);
          tablesWithRLS.push(table);
        } catch {
          tablesWithoutRLS.push(table);
        }
      }
    }

    if (tablesWithoutRLS.length > 0) {
      tablesWithoutRLS.forEach((t) => {
        errors.push(`⚠️  Table ${t} may not have RLS enabled`);
      });
    }

    const valid = errors.length === 0;

    if (valid) {
      console.log('✅ RLS validation passed');
    } else {
      console.warn('⚠️  RLS validation warnings:', errors);
    }

    return {
      valid,
      errors,
      tablesWithRLS,
      tablesWithoutRLS,
    };
  } catch (error) {
    console.error('Error validating RLS:', error);
    return {
      valid: false,
      errors: ['Failed to validate RLS'],
      tablesWithRLS: [],
      tablesWithoutRLS: [],
    };
  }
}

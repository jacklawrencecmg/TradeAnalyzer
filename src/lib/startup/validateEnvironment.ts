/**
 * Environment Validator
 *
 * Validates required environment variables on app boot.
 * Prevents app from starting if critical config is missing.
 *
 * Run on startup to ensure production safety.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface EnvVar {
  name: string;
  required: boolean;
  serverOnly?: boolean;
  description: string;
}

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    name: 'VITE_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key (public)',
  },
  {
    name: 'VITE_SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    serverOnly: true,
    description: 'Supabase service role key (SERVER ONLY)',
  },
  {
    name: 'VITE_ADMIN_SYNC_SECRET',
    required: true,
    serverOnly: true,
    description: 'Admin endpoint authentication secret',
  },
  {
    name: 'VITE_CRON_SECRET',
    required: true,
    serverOnly: true,
    description: 'Cron endpoint authentication secret',
  },
];

/**
 * Optional but recommended environment variables
 */
const OPTIONAL_ENV_VARS: EnvVar[] = [
  {
    name: 'VITE_FANTASYPROS_API_KEY',
    required: false,
    description: 'FantasyPros API key (for data sync)',
  },
  {
    name: 'VITE_ENVIRONMENT',
    required: false,
    description: 'Environment name (production/staging/development)',
  },
];

/**
 * Validate environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Node environment
  const nodeEnv = process.env.NODE_ENV;
  const viteEnv = import.meta.env.MODE;

  console.log('🔍 Validating environment...');
  console.log(`   NODE_ENV: ${nodeEnv || 'not set'}`);
  console.log(`   VITE_ENV: ${viteEnv || 'not set'}`);

  // Production mode checks
  const isProduction = viteEnv === 'production' || nodeEnv === 'production';

  if (isProduction && nodeEnv !== 'production') {
    errors.push(
      `Running in production but NODE_ENV="${nodeEnv}". Must be "production".`
    );
  }

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = import.meta.env[envVar.name];

    if (!value) {
      errors.push(
        `❌ Missing required environment variable: ${envVar.name}\n   Description: ${envVar.description}`
      );
      continue;
    }

    // Validate format
    if (envVar.name.includes('URL')) {
      try {
        new URL(value);
      } catch {
        errors.push(
          `❌ Invalid URL format for ${envVar.name}: ${value}`
        );
      }
    }

    // Check for placeholder values
    if (
      value.includes('your-') ||
      value.includes('example') ||
      value.includes('placeholder')
    ) {
      errors.push(
        `❌ Environment variable ${envVar.name} contains placeholder value: ${value}`
      );
    }

    // Server-only variables should not be in client bundle
    if (envVar.serverOnly && typeof window !== 'undefined') {
      errors.push(
        `🚨 SECURITY: Server-only variable ${envVar.name} detected in client bundle!`
      );
    }

    // Validate secret strength
    if (envVar.name.includes('SECRET')) {
      if (value.length < 32) {
        warnings.push(
          `⚠️  ${envVar.name} is too short (${value.length} chars). Should be 32+ chars.`
        );
      }
    }
  }

  // Check optional variables
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[envVar.name];

    if (!value) {
      warnings.push(
        `⚠️  Optional variable not set: ${envVar.name}\n   Description: ${envVar.description}`
      );
    }
  }

  // Production-specific checks
  if (isProduction) {
    // Check for development URLs
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && supabaseUrl.includes('localhost')) {
      errors.push(
        `❌ Production mode using localhost Supabase URL: ${supabaseUrl}`
      );
    }

    // Verify secrets are unique
    const adminSecret = import.meta.env.VITE_ADMIN_SYNC_SECRET;
    const cronSecret = import.meta.env.VITE_CRON_SECRET;

    if (adminSecret && cronSecret && adminSecret === cronSecret) {
      errors.push(
        `❌ ADMIN_SYNC_SECRET and CRON_SECRET must be different!`
      );
    }

    // Check for weak secrets
    const weakSecrets = ['admin', 'password', '123456', 'secret', 'test'];
    if (adminSecret && weakSecrets.some((weak) => adminSecret.includes(weak))) {
      errors.push(`❌ ADMIN_SYNC_SECRET is too weak!`);
    }
    if (cronSecret && weakSecrets.some((weak) => cronSecret.includes(weak))) {
      errors.push(`❌ CRON_SECRET is too weak!`);
    }
  }

  // Service role key detection in client
  if (typeof window !== 'undefined') {
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      errors.push(
        `🚨 CRITICAL SECURITY ISSUE: Service role key is exposed in client bundle!\n   This key MUST ONLY be used server-side.`
      );
    }
  }

  const valid = errors.length === 0;

  // Log results
  if (valid) {
    console.log('✅ Environment validation passed');
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} warning(s):`);
      warnings.forEach((w) => console.log(`   ${w}`));
    }
  } else {
    console.error('❌ Environment validation FAILED');
    console.error(`   ${errors.length} error(s) found:`);
    errors.forEach((e) => console.error(`   ${e}`));
  }

  return { valid, errors, warnings };
}

/**
 * Validate environment and throw if invalid (for app startup)
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment();

  if (!result.valid) {
    const errorMessage = [
      '',
      '═══════════════════════════════════════════════════',
      '🚨 ENVIRONMENT VALIDATION FAILED',
      '═══════════════════════════════════════════════════',
      '',
      'The application cannot start due to environment issues:',
      '',
      ...result.errors.map((e) => `  ${e}`),
      '',
      'Fix these issues before starting the application.',
      '',
      'See .env.example for required variables.',
      '═══════════════════════════════════════════════════',
      '',
    ].join('\n');

    console.error(errorMessage);

    throw new Error('Environment validation failed. Cannot start application.');
  }
}

/**
 * Get environment info
 */
export function getEnvironmentInfo(): {
  mode: string;
  nodeEnv: string;
  isProduction: boolean;
  supabaseUrl: string;
  hasAdminSecret: boolean;
  hasCronSecret: boolean;
} {
  return {
    mode: import.meta.env.MODE,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: import.meta.env.MODE === 'production',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'not set',
    hasAdminSecret: !!import.meta.env.VITE_ADMIN_SYNC_SECRET,
    hasCronSecret: !!import.meta.env.VITE_CRON_SECRET,
  };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return import.meta.env.MODE === 'production' || process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return import.meta.env.MODE === 'development' && process.env.NODE_ENV !== 'production';
}

/**
 * Get safe environment info (no secrets)
 */
export function getSafeEnvironmentInfo(): Record<string, any> {
  return {
    mode: import.meta.env.MODE,
    nodeEnv: process.env.NODE_ENV,
    isProduction: isProduction(),
    isDevelopment: isDevelopment(),
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    hasRequiredVars: validateEnvironment().valid,
  };
}

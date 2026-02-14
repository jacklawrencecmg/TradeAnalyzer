const requiredEnvVars = {
  client: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  server: ['SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_SYNC_SECRET', 'CRON_SECRET'],
} as const;

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
}

export function validateClientEnv(): EnvValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];

  for (const envVar of requiredEnvVars.client) {
    const value = import.meta.env[envVar];

    if (!value) {
      missing.push(envVar);
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    errors,
  };
}

export function getClientEnv() {
  const validation = validateClientEnv();

  if (!validation.valid) {
    console.error('Environment validation failed:', validation.errors);
    throw new Error(
      `Missing required environment variables: ${validation.missing.join(', ')}\n\n` +
      'Please ensure these are set in your .env file:\n' +
      validation.missing.map(v => `${v}=your_value_here`).join('\n')
    );
  }

  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function logEnvStatus() {
  const validation = validateClientEnv();

  if (validation.valid) {
    console.log('✅ All required environment variables are set');
  } else {
    console.error('❌ Environment validation failed');
    console.error('Missing variables:', validation.missing);
    console.error('\nAdd these to your .env file:');
    validation.missing.forEach(v => {
      console.error(`${v}=your_value_here`);
    });
  }

  return validation.valid;
}

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  console.error('❌ Missing required environment variables!');
  console.error('\nRequired variables:');
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  VITE_SUPABASE_ANON_KEY=your-anon-key');
  console.error('\nAdd these to your .env file in the project root.');
}

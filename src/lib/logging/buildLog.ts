import { supabase } from '../supabase';

export interface BuildLogEntry {
  id?: string;
  build_type: 'dynasty_base' | 'redraft_fill' | 'full_import';
  started_at: string;
  completed_at?: string;
  success: boolean;
  sources_used: string[];
  player_count: number;
  offense_count?: number;
  idp_count?: number;
  ppr_matched?: number;
  half_matched?: number;
  errors: string[];
  metadata?: Record<string, any>;
  created_at?: string;
}

export async function logBuildStart(
  buildType: 'dynasty_base' | 'redraft_fill' | 'full_import'
): Promise<string> {
  const entry: BuildLogEntry = {
    build_type: buildType,
    started_at: new Date().toISOString(),
    success: false,
    sources_used: [],
    player_count: 0,
    errors: [],
  };

  const { data, error } = await supabase
    .from('fantasypros_build_log')
    .insert(entry)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to log build start:', error);
    return 'local-' + Date.now();
  }

  return data.id;
}

export async function logBuildComplete(
  buildId: string,
  success: boolean,
  sourcesUsed: string[],
  playerCount: number,
  errors: string[],
  metadata?: Record<string, any>
): Promise<void> {
  if (buildId.startsWith('local-')) {
    console.log('Build completed (local):', {
      success,
      sourcesUsed,
      playerCount,
      errors,
    });
    return;
  }

  await supabase
    .from('fantasypros_build_log')
    .update({
      completed_at: new Date().toISOString(),
      success,
      sources_used: sourcesUsed,
      player_count: playerCount,
      errors,
      metadata,
    })
    .eq('id', buildId);
}

export async function getRecentBuilds(limit: number = 10): Promise<BuildLogEntry[]> {
  const { data, error } = await supabase
    .from('fantasypros_build_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get recent builds:', error);
    return [];
  }

  return data || [];
}

export async function getLastSuccessfulBuild(
  buildType?: 'dynasty_base' | 'redraft_fill' | 'full_import'
): Promise<BuildLogEntry | null> {
  let query = supabase
    .from('fantasypros_build_log')
    .select('*')
    .eq('success', true)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (buildType) {
    query = query.eq('build_type', buildType);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Failed to get last successful build:', error);
    return null;
  }

  return data;
}

export function createInMemoryLog(): BuildLogEntry {
  return {
    build_type: 'full_import',
    started_at: new Date().toISOString(),
    success: false,
    sources_used: [],
    player_count: 0,
    errors: [],
  };
}

export function updateInMemoryLog(
  log: BuildLogEntry,
  updates: Partial<BuildLogEntry>
): BuildLogEntry {
  return {
    ...log,
    ...updates,
    completed_at: updates.success !== undefined ? new Date().toISOString() : log.completed_at,
  };
}

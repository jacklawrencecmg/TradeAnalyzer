/**
 * Experiment Framework
 *
 * Provides sticky A/B/C test variant assignment for users.
 * Enables safe feature testing with measured outcomes.
 */

import { supabase } from '../supabase';

export interface Experiment {
  id: string;
  key: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  variant: string;
  trafficPercent: number;
  config: Record<string, any>;
  createdAt: string;
}

export interface UserExperimentAssignment {
  userId: string;
  experimentId: string;
  variant: string;
  assignedAt: string;
}

/**
 * Get variant for user (sticky assignment)
 *
 * Uses database function for consistent assignment across sessions.
 * If user not yet assigned, assigns based on traffic percentages.
 *
 * @param userId - User ID
 * @param experimentKey - Experiment key (e.g., 'scarcity_formula_v2')
 * @returns Variant name (e.g., 'A', 'B', 'control')
 */
export async function getExperimentVariant(
  userId: string,
  experimentKey: string
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_experiment_variant', {
      p_user_id: userId,
      p_experiment_key: experimentKey,
    });

    if (error) {
      console.error('Error getting experiment variant:', error);
      return 'control'; // Fallback to control
    }

    return data || 'control';
  } catch (err) {
    console.error('Exception getting experiment variant:', err);
    return 'control';
  }
}

/**
 * Get variant configuration
 *
 * Returns the config object for the user's assigned variant.
 */
export async function getVariantConfig(
  userId: string,
  experimentKey: string
): Promise<Record<string, any>> {
  const variant = await getExperimentVariant(userId, experimentKey);

  // Get experiment ID
  const { data: experiment } = await supabase
    .from('feature_experiments')
    .select('id')
    .eq('key', experimentKey)
    .eq('active', true)
    .maybeSingle();

  if (!experiment) {
    return {}; // No config
  }

  // Get variant config
  const { data: variantData } = await supabase
    .from('experiment_variants')
    .select('config')
    .eq('experiment_id', experiment.id)
    .eq('variant', variant)
    .maybeSingle();

  return variantData?.config || {};
}

/**
 * Create new experiment
 */
export async function createExperiment(
  key: string,
  description: string,
  variants: Array<{ variant: string; trafficPercent: number; config?: Record<string, any> }>
): Promise<Experiment | null> {
  try {
    // Create experiment
    const { data: experiment, error: expError } = await supabase
      .from('feature_experiments')
      .insert({
        key,
        description,
        active: true,
      })
      .select()
      .single();

    if (expError || !experiment) {
      console.error('Error creating experiment:', expError);
      return null;
    }

    // Create variants
    const variantInserts = variants.map((v) => ({
      experiment_id: experiment.id,
      variant: v.variant,
      traffic_percent: v.trafficPercent,
      config: v.config || {},
    }));

    const { error: varError } = await supabase
      .from('experiment_variants')
      .insert(variantInserts);

    if (varError) {
      console.error('Error creating variants:', varError);
      return null;
    }

    return {
      id: experiment.id,
      key: experiment.key,
      description: experiment.description,
      active: experiment.active,
      createdAt: experiment.created_at,
      updatedAt: experiment.updated_at,
    };
  } catch (err) {
    console.error('Exception creating experiment:', err);
    return null;
  }
}

/**
 * Get all active experiments
 */
export async function getActiveExperiments(): Promise<Experiment[]> {
  const { data, error } = await supabase
    .from('feature_experiments')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching experiments:', error);
    return [];
  }

  return (data || []).map((exp) => ({
    id: exp.id,
    key: exp.key,
    description: exp.description,
    active: exp.active,
    createdAt: exp.created_at,
    updatedAt: exp.updated_at,
  }));
}

/**
 * Get experiment variants
 */
export async function getExperimentVariants(experimentId: string): Promise<ExperimentVariant[]> {
  const { data, error } = await supabase
    .from('experiment_variants')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('variant');

  if (error) {
    console.error('Error fetching variants:', error);
    return [];
  }

  return (data || []).map((v) => ({
    id: v.id,
    experimentId: v.experiment_id,
    variant: v.variant,
    trafficPercent: v.traffic_percent,
    config: v.config || {},
    createdAt: v.created_at,
  }));
}

/**
 * Get user's experiment assignments
 */
export async function getUserAssignments(userId: string): Promise<UserExperimentAssignment[]> {
  const { data, error } = await supabase
    .from('user_experiment_assignments')
    .select('*')
    .eq('user_id', userId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error('Error fetching assignments:', error);
    return [];
  }

  return (data || []).map((a) => ({
    userId: a.user_id,
    experimentId: a.experiment_id,
    variant: a.variant,
    assignedAt: a.assigned_at,
  }));
}

/**
 * Update experiment traffic percentages
 *
 * Used for adaptive rollout (gradually increase winning variant)
 */
export async function updateVariantTraffic(
  experimentId: string,
  variant: string,
  trafficPercent: number
): Promise<boolean> {
  const { error } = await supabase
    .from('experiment_variants')
    .update({ traffic_percent: trafficPercent })
    .eq('experiment_id', experimentId)
    .eq('variant', variant);

  if (error) {
    console.error('Error updating traffic:', error);
    return false;
  }

  return true;
}

/**
 * Deactivate experiment (stop new assignments)
 */
export async function deactivateExperiment(experimentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('feature_experiments')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', experimentId);

  if (error) {
    console.error('Error deactivating experiment:', error);
    return false;
  }

  return true;
}

/**
 * Get experiment statistics
 */
export async function getExperimentStats(experimentId: string) {
  // Count assignments per variant
  const { data: assignments } = await supabase
    .from('user_experiment_assignments')
    .select('variant')
    .eq('experiment_id', experimentId);

  const variantCounts: Record<string, number> = {};

  (assignments || []).forEach((a) => {
    variantCounts[a.variant] = (variantCounts[a.variant] || 0) + 1;
  });

  return {
    totalUsers: assignments?.length || 0,
    variantCounts,
  };
}

/**
 * Example: Create scarcity formula experiment
 */
export async function createScarcityExperiment() {
  return createExperiment(
    'scarcity_formula_v2',
    'Test new scarcity adjustment formula with stronger RB premium',
    [
      {
        variant: 'control',
        trafficPercent: 50,
        config: { useNewFormula: false },
      },
      {
        variant: 'new_formula',
        trafficPercent: 50,
        config: { useNewFormula: true, rbPremium: 1.25 },
      },
    ]
  );
}

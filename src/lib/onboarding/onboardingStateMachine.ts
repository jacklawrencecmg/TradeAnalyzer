/**
 * Onboarding State Machine
 *
 * Manages the 7-step onboarding flow that proves value in 30-60 seconds:
 * 1. Welcome
 * 2. League Import
 * 3. Team Analysis (instant)
 * 4. Value Proof (3 things to do today)
 * 5. Trade Demo (interactive)
 * 6. Alerts Setup
 * 7. Complete
 *
 * Key principle: Show value BEFORE asking for time/effort
 */

import { supabase } from '../supabase';

export type OnboardingStep =
  | 'welcome'
  | 'league_import'
  | 'team_analysis'
  | 'value_proof'
  | 'trade_demo'
  | 'alerts_setup'
  | 'complete';

export interface OnboardingState {
  userId: string;
  step: OnboardingStep;
  completed: boolean;
  leagueId?: string;
  metadata: {
    leagueImported?: boolean;
    teamAnalyzed?: boolean;
    tradeDemoCompleted?: boolean;
    alertsConfigured?: boolean;
    skipReason?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'league_import',
  'team_analysis',
  'value_proof',
  'trade_demo',
  'alerts_setup',
  'complete',
];

/**
 * Get user's onboarding state
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  const { data, error } = await supabase
    .from('user_onboarding_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching onboarding state:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    step: data.step as OnboardingStep,
    completed: data.completed,
    leagueId: data.league_id,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Initialize onboarding for new user
 */
export async function initializeOnboarding(userId: string): Promise<OnboardingState | null> {
  const { data, error } = await supabase
    .from('user_onboarding_state')
    .insert({
      user_id: userId,
      step: 'welcome',
      completed: false,
      metadata: {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error initializing onboarding:', error);
    return null;
  }

  return {
    userId: data.user_id,
    step: data.step as OnboardingStep,
    completed: data.completed,
    leagueId: data.league_id,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Check if user needs onboarding
 */
export async function needsOnboarding(userId: string): Promise<boolean> {
  const state = await getOnboardingState(userId);

  if (!state) {
    return true; // New user
  }

  if (state.completed) {
    return false; // Already completed
  }

  return true; // In progress
}

/**
 * Advance to next step
 */
export async function advanceOnboardingStep(
  userId: string,
  metadata?: Record<string, any>
): Promise<OnboardingState | null> {
  const state = await getOnboardingState(userId);

  if (!state) {
    console.error('No onboarding state found');
    return null;
  }

  const currentIndex = STEP_ORDER.indexOf(state.step);
  const nextStep = STEP_ORDER[currentIndex + 1];

  if (!nextStep) {
    // Already at last step
    return state;
  }

  const updatedMetadata = { ...state.metadata, ...metadata };

  const { data, error } = await supabase
    .from('user_onboarding_state')
    .update({
      step: nextStep,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error advancing onboarding:', error);
    return null;
  }

  return {
    userId: data.user_id,
    step: data.step as OnboardingStep,
    completed: data.completed,
    leagueId: data.league_id,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Jump to specific step
 */
export async function setOnboardingStep(
  userId: string,
  step: OnboardingStep,
  metadata?: Record<string, any>
): Promise<OnboardingState | null> {
  const state = await getOnboardingState(userId);

  if (!state) {
    console.error('No onboarding state found');
    return null;
  }

  const updatedMetadata = { ...state.metadata, ...metadata };

  const { data, error } = await supabase
    .from('user_onboarding_state')
    .update({
      step,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error setting onboarding step:', error);
    return null;
  }

  return {
    userId: data.user_id,
    step: data.step as OnboardingStep,
    completed: data.completed,
    leagueId: data.league_id,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_onboarding_state')
    .update({
      step: 'complete',
      completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error completing onboarding:', error);
    return false;
  }

  return true;
}

/**
 * Skip onboarding (with reason)
 */
export async function skipOnboarding(userId: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_onboarding_state')
    .update({
      step: 'complete',
      completed: true,
      metadata: { skipReason: reason },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error skipping onboarding:', error);
    return false;
  }

  return true;
}

/**
 * Reset onboarding for new league or season
 */
export async function resetOnboarding(
  userId: string,
  reason: 'new_league' | 'season_rollover'
): Promise<boolean> {
  const { error } = await supabase
    .from('user_onboarding_state')
    .update({
      step: 'welcome',
      completed: false,
      metadata: { resetReason: reason },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error resetting onboarding:', error);
    return false;
  }

  return true;
}

/**
 * Get onboarding progress percentage
 */
export function getOnboardingProgress(step: OnboardingStep): number {
  const index = STEP_ORDER.indexOf(step);
  const total = STEP_ORDER.length - 1; // Exclude 'complete'
  return Math.round((index / total) * 100);
}

/**
 * Get next step title
 */
export function getStepTitle(step: OnboardingStep): string {
  const titles: Record<OnboardingStep, string> = {
    welcome: 'Welcome to Dynasty Dominator',
    league_import: 'Import Your League',
    team_analysis: 'Analyzing Your Team',
    value_proof: 'Your Team Insights',
    trade_demo: 'Try the Trade Calculator',
    alerts_setup: 'Get Personalized Alerts',
    complete: "You're Ready!",
  };

  return titles[step];
}

/**
 * Get step description
 */
export function getStepDescription(step: OnboardingStep): string {
  const descriptions: Record<OnboardingStep, string> = {
    welcome: 'Get personalized insights in 60 seconds',
    league_import: 'Everything else builds automatically',
    team_analysis: 'Understanding your roster strength',
    value_proof: 'Opportunities you should act on today',
    trade_demo: 'See how league-aware values work',
    alerts_setup: 'Never miss an opportunity',
    complete: 'Start dominating your league',
  };

  return descriptions[step];
}

/**
 * Check if user should see onboarding
 *
 * Skip logic:
 * - User has completed onboarding
 * - User has existing leagues (unless new league imported)
 * - Season hasn't rolled over
 */
export async function shouldShowOnboarding(userId: string): Promise<boolean> {
  const state = await getOnboardingState(userId);

  // New user - always show
  if (!state) {
    return true;
  }

  // Already completed - don't show
  if (state.completed) {
    // Check for reset conditions
    const shouldReset = await checkResetConditions(userId, state);
    return shouldReset;
  }

  // In progress - show
  return true;
}

/**
 * Check if onboarding should be reset
 */
async function checkResetConditions(
  userId: string,
  state: OnboardingState
): Promise<boolean> {
  // Check for new league imported after onboarding
  // TODO: Implement league check

  // Check for season rollover
  // TODO: Implement season check

  return false;
}

/**
 * Update league ID in onboarding state
 */
export async function setOnboardingLeague(
  userId: string,
  leagueId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_onboarding_state')
    .update({
      league_id: leagueId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error setting onboarding league:', error);
    return false;
  }

  return true;
}

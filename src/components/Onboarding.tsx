/**
 * Onboarding Flow Component
 *
 * Guided 7-step flow that proves value in 30-60 seconds:
 * 1. Welcome → Why we're different
 * 2. League Import → Everything builds from this
 * 3. Team Analysis → Instant insights
 * 4. Value Proof → 3 things to do today
 * 5. Trade Demo → See how it works
 * 6. Alerts Setup → Never miss opportunities
 * 7. Complete → Go to dashboard
 *
 * Key principle: Show value BEFORE asking for time/effort
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  getOnboardingState,
  initializeOnboarding,
  advanceOnboardingStep,
  completeOnboarding,
  skipOnboarding,
  getOnboardingProgress,
  type OnboardingStep,
} from '../lib/onboarding/onboardingStateMachine';

// Step components
import { WelcomeStep } from './onboarding/WelcomeStep';
import { LeagueImportStep } from './onboarding/LeagueImportStep';
import { TeamAnalysisStep } from './onboarding/TeamAnalysisStep';
import { ValueProofStep } from './onboarding/ValueProofStep';
import { TradeDemoStep } from './onboarding/TradeDemoStep';
import { AlertsSetupStep } from './onboarding/AlertsSetupStep';
import { CompleteStep } from './onboarding/CompleteStep';

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize onboarding state
  useEffect(() => {
    if (!user) return;

    loadOnboardingState();
  }, [user]);

  async function loadOnboardingState() {
    if (!user) return;

    setLoading(true);

    try {
      let state = await getOnboardingState(user.id);

      if (!state) {
        // Initialize for new user
        state = await initializeOnboarding(user.id);
      }

      if (state) {
        setCurrentStep(state.step);
        setLeagueId(state.leagueId || null);
      }
    } catch (err) {
      console.error('Error loading onboarding state:', err);
      setError('Failed to load onboarding state');
    } finally {
      setLoading(false);
    }
  }

  async function handleNext(metadata?: Record<string, any>) {
    if (!user) return;

    try {
      const newState = await advanceOnboardingStep(user.id, metadata);

      if (newState) {
        setCurrentStep(newState.step);

        if (newState.step === 'complete') {
          // Onboarding complete
          setTimeout(() => {
            onComplete();
          }, 2000); // Small delay to show completion screen
        }
      }
    } catch (err) {
      console.error('Error advancing onboarding:', err);
      setError('Failed to advance onboarding');
    }
  }

  async function handleSkip() {
    if (!user) return;

    const confirmed = window.confirm('Skip onboarding? You can always import your league later.');

    if (confirmed) {
      await skipOnboarding(user.id, 'user_skipped');
      onComplete();
    }
  }

  function handleLeagueImported(importedLeagueId: string) {
    setLeagueId(importedLeagueId);
    handleNext({ leagueImported: true, leagueId: importedLeagueId });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={loadOnboardingState}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const progress = getOnboardingProgress(currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Skip Button */}
      {currentStep !== 'complete' && (
        <button
          onClick={handleSkip}
          className="fixed top-4 right-4 text-sm text-gray-600 hover:text-gray-900 underline z-40"
        >
          Skip for now
        </button>
      )}

      {/* Step Content */}
      <div className="container mx-auto px-4 py-12">
        {currentStep === 'welcome' && <WelcomeStep onNext={handleNext} />}

        {currentStep === 'league_import' && (
          <LeagueImportStep onNext={handleLeagueImported} onSkip={() => handleNext()} />
        )}

        {currentStep === 'team_analysis' && (
          <TeamAnalysisStep leagueId={leagueId} onNext={handleNext} />
        )}

        {currentStep === 'value_proof' && (
          <ValueProofStep leagueId={leagueId} onNext={handleNext} />
        )}

        {currentStep === 'trade_demo' && (
          <TradeDemoStep leagueId={leagueId} onNext={handleNext} />
        )}

        {currentStep === 'alerts_setup' && <AlertsSetupStep onNext={handleNext} />}

        {currentStep === 'complete' && <CompleteStep leagueId={leagueId} />}
      </div>
    </div>
  );
}

export default Onboarding;

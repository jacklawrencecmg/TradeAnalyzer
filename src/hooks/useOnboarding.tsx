/**
 * Onboarding Hook
 *
 * Manages onboarding state and provides helper methods
 */

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import {
  shouldShowOnboarding,
  getOnboardingState,
  type OnboardingStep,
} from '../lib/onboarding/onboardingStateMachine';

export function useOnboarding() {
  const { user } = useAuth();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNeedsOnboarding(false);
      setLoading(false);
      return;
    }

    checkOnboarding();
  }, [user]);

  async function checkOnboarding() {
    if (!user) return;

    setLoading(true);

    try {
      const shouldShow = await shouldShowOnboarding(user.id);
      setNeedsOnboarding(shouldShow);

      if (shouldShow) {
        const state = await getOnboardingState(user.id);
        if (state) {
          setCurrentStep(state.step);
        }
      }
    } catch (error) {
      console.error('Error checking onboarding:', error);
    } finally {
      setLoading(false);
    }
  }

  return {
    needsOnboarding,
    currentStep,
    loading,
    refresh: checkOnboarding,
  };
}

export default useOnboarding;

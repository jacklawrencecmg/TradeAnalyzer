/**
 * Team Analysis Step
 *
 * Quick loading screen while we analyze imported team
 * Builds anticipation for value proof
 */

import React, { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

export function TeamAnalysisStep({
  leagueId,
  onNext,
}: {
  leagueId: string | null;
  onNext: () => void;
}) {
  useEffect(() => {
    // Auto-advance after analysis
    const timer = setTimeout(() => {
      onNext();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onNext]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>

        <h2 className="text-3xl font-bold text-gray-900 mb-2">Analyzing Your Team</h2>
        <p className="text-gray-600 mb-8">This will just take a moment...</p>

        <div className="space-y-3 text-left max-w-md mx-auto">
          <AnalysisStep text="Loading roster data" done />
          <AnalysisStep text="Calculating player values" done />
          <AnalysisStep text="Analyzing team strategy" active />
          <AnalysisStep text="Identifying opportunities" />
        </div>
      </div>
    </div>
  );
}

function AnalysisStep({ text, done = false, active = false }: { text: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
      ) : active ? (
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
      ) : (
        <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0"></div>
      )}
      <span className={`${done ? 'text-gray-600' : active ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
        {text}
      </span>
    </div>
  );
}

export default TeamAnalysisStep;

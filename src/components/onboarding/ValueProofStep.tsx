/**
 * Value Proof Step
 *
 * MOST IMPORTANT SCREEN - This is where user decides if app is legit
 *
 * Shows:
 * 1. Team strength analysis (Contender/Playoff/Rebuild)
 * 2. Positional strengths/weaknesses
 * 3. 3 Things You Should Do Today (from advice engine)
 *
 * Must feel personalized and actionable within seconds
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Target } from 'lucide-react';
import { calculateConfidence, type ConfidenceScore } from '../../lib/onboarding/confidenceMeter';
import { useAuth } from '../../hooks/useAuth';

export function ValueProofStep({
  leagueId,
  onNext,
}: {
  leagueId: string | null;
  onNext: () => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [confidence, setConfidence] = useState<ConfidenceScore | null>(null);
  const [teamAnalysis, setTeamAnalysis] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    analyzeTeam();
  }, [user, leagueId]);

  async function analyzeTeam() {
    if (!user) return;

    setLoading(true);

    try {
      // Get confidence score
      const conf = await calculateConfidence(user.id, leagueId || undefined);
      setConfidence(conf);

      // TODO: Get actual team analysis
      // For now, mock data
      const mockAnalysis = {
        strategy: 'Contender',
        strengths: [
          { position: 'WR', score: 92, label: 'Elite' },
          { position: 'RB', score: 78, label: 'Strong' },
        ],
        weaknesses: [{ position: 'TE', score: 45, label: 'Weakness' }],
        opportunities: [
          {
            type: 'buy_low',
            player: 'Garrett Wilson',
            confidence: 85,
            reason: 'Market undervaluing due to QB instability, but target share elite',
          },
          {
            type: 'sell_high',
            player: 'Tony Pollard',
            confidence: 78,
            reason: 'Peak value window before workload concerns resurface',
          },
          {
            type: 'waiver',
            player: 'Roschon Johnson',
            confidence: 72,
            reason: 'Backup with clear path to starter role if injury occurs',
          },
        ],
      };

      setTeamAnalysis(mockAnalysis);
    } catch (error) {
      console.error('Error analyzing team:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Your Team...</h2>
          <p className="text-gray-600">
            Calculating strengths, weaknesses, and opportunities
          </p>

          <div className="mt-8 space-y-2 text-left max-w-md mx-auto">
            <AnalysisStep text="Loading roster data" done />
            <AnalysisStep text="Calculating positional values" done />
            <AnalysisStep text="Identifying team strategy" active />
            <AnalysisStep text="Finding opportunities" />
          </div>
        </div>
      </div>
    );
  }

  if (!teamAnalysis) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Unable to analyze team
          </h2>
          <p className="text-gray-600 mb-6">
            We need league data to provide personalized insights
          </p>
          <button
            onClick={onNext}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Team Insights</h1>
        <p className="text-lg text-gray-600">
          Personalized analysis for your roster
        </p>
      </div>

      {/* Confidence Meter */}
      {confidence && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Model Confidence: {confidence.level === 'very_high' ? 'Very High' : confidence.level === 'high' ? 'High' : confidence.level === 'medium' ? 'Medium' : 'Low'}
              </h3>
              <p className="text-sm text-gray-600">{confidence.recommendation}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-blue-600">{confidence.overall}%</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000"
              style={{ width: `${confidence.overall}%` }}
            />
          </div>
        </div>
      )}

      {/* Team Strategy */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Team Strength</h2>

        <div className="text-center mb-8">
          <div
            className={`inline-block px-8 py-4 rounded-lg text-2xl font-bold ${
              teamAnalysis.strategy === 'Contender'
                ? 'bg-green-100 text-green-800'
                : teamAnalysis.strategy === 'Playoff'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-orange-100 text-orange-800'
            }`}
          >
            {teamAnalysis.strategy}
          </div>
          <p className="text-gray-600 mt-2">
            {teamAnalysis.strategy === 'Contender'
              ? 'Championship-caliber roster with multiple elite assets'
              : teamAnalysis.strategy === 'Playoff'
              ? 'Competitive roster with room for improvement'
              : 'Rebuilding with focus on future assets'}
          </p>
        </div>

        {/* Positional Breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Strengths
            </h3>
            <div className="space-y-2">
              {teamAnalysis.strengths.map((strength: any) => (
                <PositionBar
                  key={strength.position}
                  position={strength.position}
                  score={strength.score}
                  label={strength.label}
                  color="green"
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Weaknesses
            </h3>
            <div className="space-y-2">
              {teamAnalysis.weaknesses.map((weakness: any) => (
                <PositionBar
                  key={weakness.position}
                  position={weakness.position}
                  score={weakness.score}
                  label={weakness.label}
                  color="red"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Things To Do Today */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Target className="w-7 h-7 text-blue-600" />
          3 Things You Should Do Today
        </h2>
        <p className="text-gray-600 mb-6">
          Actionable opportunities based on your roster
        </p>

        <div className="space-y-4">
          {teamAnalysis.opportunities.map((opp: any, idx: number) => (
            <OpportunityCard key={idx} opportunity={opp} rank={idx + 1} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <button
          onClick={onNext}
          className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          See How It Works
        </button>
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

function PositionBar({
  position,
  score,
  label,
  color,
}: {
  position: string;
  score: number;
  label: string;
  color: 'green' | 'red';
}) {
  const colorClasses = color === 'green' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-900">{position}</span>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses} transition-all duration-1000`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity, rank }: { opportunity: any; rank: number }) {
  const icons = {
    buy_low: <TrendingDown className="w-6 h-6 text-green-600" />,
    sell_high: <TrendingUp className="w-6 h-6 text-red-600" />,
    waiver: <Target className="w-6 h-6 text-blue-600" />,
  };

  const labels = {
    buy_low: 'Buy Low',
    sell_high: 'Sell High',
    waiver: 'Waiver Target',
  };

  return (
    <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
          {rank}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icons[opportunity.type as keyof typeof icons]}
            <h3 className="text-lg font-bold text-gray-900">
              {labels[opportunity.type as keyof typeof labels]}: {opportunity.player}
            </h3>
            <span className="ml-auto text-sm font-semibold text-blue-600">
              {opportunity.confidence}% confidence
            </span>
          </div>

          <p className="text-gray-700">{opportunity.reason}</p>
        </div>
      </div>
    </div>
  );
}

export default ValueProofStep;

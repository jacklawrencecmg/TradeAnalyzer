/**
 * Trade Demo Step
 *
 * Interactive walkthrough showing:
 * - How trade calculator works
 * - Why our values are different (league-aware)
 * - Fairness thresholds
 * - Team strategy impact
 */

import React, { useState } from 'react';
import { ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

export function TradeDemoStep({
  leagueId,
  onNext,
}: {
  leagueId: string | null;
  onNext: () => void;
}) {
  const [step, setStep] = useState(0);

  const demoSteps = [
    {
      title: 'Try the Trade Calculator',
      description: 'Let\'s walk through a sample trade',
    },
    {
      title: 'Trade Evaluation',
      description: 'We analyze fairness + team fit',
    },
    {
      title: 'You\'re Ready!',
      description: 'Now you understand how it works',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">See How It Works</h1>
        <p className="text-lg text-gray-600">Interactive trade calculator demo</p>
      </div>

      {step === 0 && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Example Trade</h2>

          {/* Mock Trade UI */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="border-2 border-blue-600 rounded-lg p-6 bg-blue-50">
              <h3 className="font-bold text-blue-900 mb-4">You Give</h3>
              <div className="space-y-2">
                <PlayerCard name="Tony Pollard" position="RB" value={4200} />
                <PlayerCard name="2024 2nd" position="Pick" value={800} />
              </div>
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex justify-between font-bold text-blue-900">
                  <span>Total Value</span>
                  <span>5,000</span>
                </div>
              </div>
            </div>

            <div className="border-2 border-green-600 rounded-lg p-6 bg-green-50">
              <h3 className="font-bold text-green-900 mb-4">You Receive</h3>
              <div className="space-y-2">
                <PlayerCard name="Garrett Wilson" position="WR" value={5200} />
              </div>
              <div className="mt-4 pt-4 border-t border-green-200">
                <div className="flex justify-between font-bold text-green-900">
                  <span>Total Value</span>
                  <span>5,200</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            Evaluate Trade
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-100 text-green-800 rounded-full font-bold text-lg">
              <CheckCircle className="w-6 h-6" />
              Fair Trade
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Value Analysis</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">You Give:</span>
                  <span className="font-semibold">5,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">You Receive:</span>
                  <span className="font-semibold">5,200</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Net Gain:</span>
                  <span className="font-semibold text-green-600">+200</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Team Fit</h3>
              <div className="space-y-2">
                <FitBadge
                  label="Positional Need"
                  status="good"
                  text="Upgrades WR corps"
                />
                <FitBadge
                  label="Strategy Fit"
                  status="good"
                  text="Contender move"
                />
              </div>
            </div>
          </div>

          {/* Why Different */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Why we value Garrett Wilson higher:
            </h3>
            <p className="text-blue-900">
              Your league starts 3 WR (higher than standard 2), increasing WR scarcity. Elite target volume provides stable floor despite QB instability.
            </p>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            Got it! Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Ready!</h2>
          <p className="text-gray-600 mb-8">
            Now you understand how league-aware values work
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 mb-3">Remember:</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Values adjust for YOUR league settings
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                We consider team strategy and positional needs
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">•</span>
                Fairness thresholds prevent bad trades
              </li>
            </ul>
          </div>

          <button
            onClick={onNext}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ name, position, value }: { name: string; position: string; value: number }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
      <div>
        <div className="font-semibold text-gray-900">{name}</div>
        <div className="text-sm text-gray-600">{position}</div>
      </div>
      <div className="font-bold text-gray-900">{value.toLocaleString()}</div>
    </div>
  );
}

function FitBadge({ label, status, text }: { label: string; status: 'good' | 'neutral' | 'bad'; text: string }) {
  const colors = {
    good: 'bg-green-100 text-green-800',
    neutral: 'bg-yellow-100 text-yellow-800',
    bad: 'bg-red-100 text-red-800',
  };

  return (
    <div className={`px-3 py-2 rounded ${colors[status]}`}>
      <div className="text-xs font-semibold mb-1">{label}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}

export default TradeDemoStep;

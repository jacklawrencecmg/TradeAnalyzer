import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { getPresetLabel, getPresetIcon, type IDPScoringPreset } from '../lib/idp/getIdpPreset';
import { getPresetComparison } from '../lib/fdp/applyIdpPreset';

interface IDPPresetImpactProps {
  baseValue: number;
  position: 'DL' | 'LB' | 'DB';
  currentPreset?: IDPScoringPreset;
}

export function IDPPresetImpact({ baseValue, position, currentPreset = 'balanced' }: IDPPresetImpactProps) {
  const comparison = getPresetComparison(baseValue, position);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">IDP Scoring Impact</h3>
      </div>

      <div className="space-y-3">
        <div className="text-sm text-gray-600 mb-3">
          How this {position} player's value changes across different IDP scoring systems:
        </div>

        <div className="grid grid-cols-1 gap-3">
          {comparison.map(({ preset, value, multiplier, change, changePercent, label }) => {
            const isCurrent = preset === currentPreset;
            const isPositive = change > 0;
            const isNegative = change < 0;

            return (
              <div
                key={preset}
                className={`relative rounded-lg p-3 border-2 transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Current
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getPresetIcon(preset)}</span>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {getPresetLabel(preset)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {multiplier.toFixed(2)}x multiplier
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {value.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      {isPositive && (
                        <>
                          <TrendingUp className="w-3 h-3 text-green-600" />
                          <span className="text-green-600">+{changePercent}%</span>
                        </>
                      )}
                      {isNegative && (
                        <>
                          <TrendingDown className="w-3 h-3 text-red-600" />
                          <span className="text-red-600">{changePercent}%</span>
                        </>
                      )}
                      {!isPositive && !isNegative && (
                        <>
                          <Minus className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-500">Baseline</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                      label === 'Best'
                        ? 'bg-green-100 text-green-800'
                        : label === 'Worst'
                        ? 'bg-red-100 text-red-800'
                        : label === 'Good'
                        ? 'bg-blue-100 text-blue-800'
                        : label === 'Below Avg'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-sm text-yellow-900">
            <span className="font-semibold">💡 Strategy Tip:</span>
            {position === 'LB' && (
              <span> Target tackle-heavy LBs in leagues with high tackle points. They gain up to 30% more value!</span>
            )}
            {position === 'DL' && (
              <span> EDGE rushers thrive in big-play leagues with sack bonuses. They can gain 25% more value!</span>
            )}
            {position === 'DB' && (
              <span> Safeties with tackle upside are best in tackle-heavy leagues. Pure coverage CBs lose value!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface IDPPresetExplanationProps {
  position: 'DL' | 'LB' | 'DB';
  format: string;
}

export function IDPPresetExplanation({ position, format }: IDPPresetExplanationProps) {
  const presetDescriptions: Record<string, Record<string, string>> = {
    LB: {
      tackle_heavy: 'Linebackers dominate tackle-heavy scoring with +30% value boost. ILBs and MLBs see the biggest gains.',
      balanced: 'Standard IDP scoring gives LBs a +15% premium for consistent tackle volume.',
      big_play: 'Tackle-heavy LBs lose -5% value when big plays are heavily rewarded. Target pass rushing OLBs instead.',
    },
    DL: {
      tackle_heavy: 'Pass rushers lose -5% value without big play bonuses. Interior DTs with tackle upside hold steady.',
      balanced: 'Edge rushers get a slight +5% premium in balanced scoring. All DL types remain viable.',
      big_play: 'EDGE rushers gain +25% value with heavy sack bonuses. Elite pass rushers become premium assets.',
    },
    DB: {
      tackle_heavy: 'Safeties with tackle production gain +5% value. Pure coverage CBs remain neutral.',
      balanced: 'Standard scoring - DBs valued for versatility across tackles, INTs, and PBUs.',
      big_play: 'DBs lose -10% value despite INT potential. Lower tackle points hurt their floor significantly.',
    },
  };

  const preset = format.toLowerCase().includes('bigplay') || format.toLowerCase().includes('big_play')
    ? 'big_play'
    : format.toLowerCase().includes('balanced')
    ? 'balanced'
    : 'tackle_heavy';

  const description = presetDescriptions[position]?.[preset] || 'Value adjusted for league scoring settings.';

  return (
    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold text-blue-900 mb-1">
          {getPresetIcon(preset as IDPScoringPreset)} {getPresetLabel(preset as IDPScoringPreset)} Scoring
        </div>
        <div className="text-sm text-blue-800">{description}</div>
      </div>
    </div>
  );
}

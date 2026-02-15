import { AlertTriangle, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';
import { TradeEvaluationResult, FairnessFlag } from '../lib/trade/evaluateTrade';

interface TradeFairnessWarningProps {
  evaluation: TradeEvaluationResult;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export default function TradeFairnessWarning({
  evaluation,
  onAccept,
  onReject,
  showActions = true,
}: TradeFairnessWarningProps) {
  const {
    fairness_score,
    recommendation,
    flags,
    warnings,
    tier_analysis,
    positional_analysis,
  } = evaluation;

  // Determine color scheme based on recommendation
  const getColorScheme = () => {
    if (recommendation === 'fair' && fairness_score >= 90) {
      return {
        bg: 'bg-green-900/30',
        border: 'border-green-500/50',
        text: 'text-green-400',
        icon: CheckCircle,
        label: 'Fair Trade',
        description: 'This trade appears structurally balanced',
      };
    } else if (recommendation === 'fair' || (recommendation.includes('lean') && fairness_score >= 75)) {
      return {
        bg: 'bg-yellow-900/30',
        border: 'border-yellow-500/50',
        text: 'text-yellow-400',
        icon: AlertCircle,
        label: 'Slightly Uneven',
        description: 'Minor structural concerns, but within acceptable range',
      };
    } else if (recommendation === 'risky') {
      return {
        bg: 'bg-orange-900/30',
        border: 'border-orange-500/50',
        text: 'text-orange-400',
        icon: AlertTriangle,
        label: 'Risky Trade',
        description: 'Significant structural imbalance detected',
      };
    } else {
      return {
        bg: 'bg-red-900/30',
        border: 'border-red-500/50',
        text: 'text-red-400',
        icon: XCircle,
        label: 'Unfair Trade',
        description: 'League-breaking imbalance - proceed with caution',
      };
    }
  };

  const colorScheme = getColorScheme();
  const Icon = colorScheme.icon;

  // Sort flags by severity
  const sortedFlags = [...flags].sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <div className={`rounded-lg border ${colorScheme.border} ${colorScheme.bg} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start gap-3">
          <Icon className={`w-6 h-6 ${colorScheme.text} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-1">
              <h3 className={`text-lg font-bold ${colorScheme.text}`}>
                {colorScheme.label}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Fairness Score:</span>
                <span className={`text-xl font-bold ${colorScheme.text}`}>
                  {fairness_score.toFixed(0)}
                </span>
                <span className="text-gray-500">/100</span>
              </div>
            </div>
            <p className="text-sm text-gray-300">{colorScheme.description}</p>
          </div>
        </div>

        {/* Fairness Score Bar */}
        <div className="mt-3">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                fairness_score >= 90 ? 'bg-green-500' :
                fairness_score >= 75 ? 'bg-yellow-500' :
                fairness_score >= 60 ? 'bg-orange-500' :
                'bg-red-500'
              }`}
              style={{ width: `${fairness_score}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Unfair</span>
            <span>60</span>
            <span>75</span>
            <span>90</span>
            <span>Fair</span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Key Concerns
          </h4>
          <ul className="space-y-1">
            {warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Flags */}
      {sortedFlags.length > 0 && (
        <div className="p-4 border-b border-gray-700">
          <h4 className="text-sm font-semibold text-white mb-3">Structural Issues</h4>
          <div className="space-y-2">
            {sortedFlags.map((flag, idx) => (
              <FlagItem key={idx} flag={flag} />
            ))}
          </div>
        </div>
      )}

      {/* Tier Analysis */}
      {tier_analysis.elite_split && (
        <div className="p-4 border-b border-gray-700 bg-red-900/10">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Elite Player Alert
          </h4>
          <p className="text-sm text-gray-300 mb-2">
            One side is giving up an elite player (Tier 1) without receiving an elite player in return.
          </p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400">Team A Tier 1:</span>
              <span className="ml-2 text-white font-medium">
                {tier_analysis.teamA_tiers[1] || 0}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Team B Tier 1:</span>
              <span className="ml-2 text-white font-medium">
                {tier_analysis.teamB_tiers[1] || 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Positional Analysis */}
      {positional_analysis.scarcity_violation && (
        <div className="p-4 border-b border-gray-700 bg-orange-900/10">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-orange-400" />
            Positional Scarcity Warning
          </h4>
          <p className="text-sm text-gray-300">
            Scarce positions (QB/RB/TE) are being traded without positional return, which may create roster imbalance.
          </p>
        </div>
      )}

      {/* Info Banner */}
      <div className="p-3 bg-blue-900/10 border-b border-blue-500/30">
        <div className="flex items-start gap-2 text-xs text-blue-300">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Note:</strong> This evaluation analyzes trade structure beyond raw values.
            Displayed values are unchanged - fairness engine only evaluates balance.
          </p>
        </div>
      </div>

      {/* Actions */}
      {showActions && (onAccept || onReject) && (
        <div className="p-4 flex items-center justify-end gap-3">
          {onReject && (
            <button
              onClick={onReject}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Review Trade
            </button>
          )}
          {onAccept && (
            <button
              onClick={onAccept}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                recommendation === 'unfair'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : recommendation === 'risky'
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-[#00d4ff] hover:bg-[#00b8e6] text-gray-900'
              }`}
            >
              {recommendation === 'unfair' ? 'Proceed Anyway' : 'Accept Trade'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual flag item component
 */
function FlagItem({ flag }: { flag: FairnessFlag }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-900/30';
      case 'high': return 'bg-orange-900/30';
      case 'medium': return 'bg-yellow-900/30';
      case 'low': return 'bg-blue-900/30';
      default: return 'bg-gray-900/30';
    }
  };

  return (
    <div className={`p-3 rounded ${getSeverityBg(flag.severity)} border border-gray-700`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase ${getSeverityColor(flag.severity)}`}>
              {flag.severity}
            </span>
            <span className="text-xs text-gray-500">
              -{flag.penalty} pts
            </span>
          </div>
          <p className="text-sm text-gray-300">{flag.message}</p>
        </div>
      </div>
    </div>
  );
}

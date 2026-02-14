import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, Calendar, AlertCircle, Edit2, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ListSkeleton } from './LoadingSkeleton';
import { getCurrentPhaseInfo, getPhaseEmoji, type SeasonPhase } from '../lib/picks/seasonPhase';
import { getMultiplierPercentage, phaseMultiplierDescriptions } from '../lib/picks/phaseMultipliers';
import { getPickLabel, type PickType } from '../lib/picks/basePickValues';

interface PickValue {
  id: string;
  season: number;
  pick: PickType;
  base_value: number;
  adjusted_value: number;
  phase: SeasonPhase;
  manual_override: boolean;
  override_value: number | null;
  updated_at: string;
}

export default function RookiePickValues() {
  const [pickValues, setPickValues] = useState<PickValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editingPick, setEditingPick] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(new Date().getFullYear() + 1);

  const phaseInfo = getCurrentPhaseInfo();

  useEffect(() => {
    fetchPickValues();
  }, [selectedSeason]);

  const fetchPickValues = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rookie_pick_values')
        .select('*')
        .eq('season', selectedSeason)
        .order('base_value', { ascending: false });

      if (error) throw error;

      setPickValues(data || []);
    } catch (err) {
      console.error('Error fetching pick values:', err);
      showMessage('error', 'Failed to load pick values');
    } finally {
      setLoading(false);
    }
  };

  const recalculateValues = async () => {
    try {
      setUpdating(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/recalc-pick-values`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to recalculate pick values');

      const result = await response.json();
      showMessage('success', `Updated ${result.updated_count} pick values`);
      await fetchPickValues();
    } catch (err) {
      console.error('Error recalculating values:', err);
      showMessage('error', 'Failed to recalculate values');
    } finally {
      setUpdating(false);
    }
  };

  const startEdit = (pick: PickValue) => {
    setEditingPick(pick.id);
    setOverrideValue(pick.manual_override ? (pick.override_value || pick.adjusted_value) : pick.adjusted_value);
  };

  const cancelEdit = () => {
    setEditingPick(null);
    setOverrideValue(0);
  };

  const saveOverride = async (pick: PickValue) => {
    try {
      const { error } = await supabase
        .from('rookie_pick_values')
        .update({
          manual_override: true,
          override_value: overrideValue,
        })
        .eq('id', pick.id);

      if (error) throw error;

      showMessage('success', `Manual override saved for ${getPickLabel(pick.pick)}`);
      setEditingPick(null);
      await fetchPickValues();
    } catch (err) {
      console.error('Error saving override:', err);
      showMessage('error', 'Failed to save override');
    }
  };

  const removeOverride = async (pick: PickValue) => {
    try {
      const { error } = await supabase
        .from('rookie_pick_values')
        .update({
          manual_override: false,
          override_value: null,
        })
        .eq('id', pick.id);

      if (error) throw error;

      showMessage('success', `Override removed for ${getPickLabel(pick.pick)}`);
      await fetchPickValues();
    } catch (err) {
      console.error('Error removing override:', err);
      showMessage('error', 'Failed to remove override');
    }
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getCurrentValue = (pick: PickValue): number => {
    if (pick.manual_override && pick.override_value !== null) {
      return pick.override_value;
    }
    return pick.adjusted_value;
  };

  const getAdjustment = (pick: PickValue): number => {
    return pick.adjusted_value - pick.base_value;
  };

  const formatValue = (value: number): string => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (loading) {
    return <ListSkeleton count={6} />;
  }

  const seasons = [
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
    new Date().getFullYear() + 2,
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rookie Pick Values</h2>
          <p className="text-sm text-gray-600 mt-1">
            Dynamic pick valuations based on NFL calendar phase
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {seasons.map(year => (
              <option key={year} value={year}>{year} Draft</option>
            ))}
          </select>
          <button
            onClick={recalculateValues}
            disabled={updating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
            {updating ? 'Updating...' : 'Recalculate'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : message.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : message.type === 'error' ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <TrendingUp className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-4xl">{getPhaseEmoji(phaseInfo.phase)}</div>
          <div>
            <h3 className="text-xl font-bold text-blue-900">{phaseInfo.label}</h3>
            <p className="text-sm text-blue-700">{phaseInfo.monthRange}</p>
          </div>
        </div>
        <p className="text-blue-800 mb-3">{phaseInfo.description}</p>
        <div className="bg-white/60 rounded-lg p-3">
          <p className="text-sm font-semibold text-blue-900">
            Current Adjustment: {getMultiplierPercentage(phaseInfo.phase)}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            {phaseMultiplierDescriptions[phaseInfo.phase]}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Pick Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Base Value
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Phase Adj
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Adjusted Value
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Current Value
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Source
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pickValues.map((pick) => {
                const isEditing = editingPick === pick.id;
                const adjustment = getAdjustment(pick);
                const currentValue = getCurrentValue(pick);

                return (
                  <tr key={pick.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {getPickLabel(pick.pick)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-600">{formatValue(pick.base_value)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          adjustment > 0
                            ? 'text-green-600'
                            : adjustment < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {adjustment > 0 ? '+' : ''}
                        {formatValue(adjustment)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-900 font-semibold">
                        {formatValue(pick.adjusted_value)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={overrideValue}
                          onChange={(e) => setOverrideValue(parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 outline-none"
                          min="0"
                          max="15000"
                        />
                      ) : (
                        <span className="text-gray-900 font-bold text-lg">
                          {formatValue(currentValue)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pick.manual_override ? (
                        <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                          Manual
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                          Auto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveOverride(pick)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(pick)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit Override"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {pick.manual_override && (
                              <button
                                onClick={() => removeOverride(pick)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Remove Override"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          How Dynamic Valuations Work
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Base Value:</strong> Year-round baseline value for each pick tier
          </p>
          <p>
            <strong>Phase Adjustment:</strong> Automatic multiplier based on NFL calendar (pre-draft hype,
            rookie fever, etc.)
          </p>
          <p>
            <strong>Adjusted Value:</strong> Base value × phase multiplier (used in trade calculator)
          </p>
          <p>
            <strong>Manual Override:</strong> Admin can set custom values that ignore phase adjustments
          </p>
          <p className="mt-3 pt-3 border-t border-blue-200">
            <strong>Current Phase:</strong> {phaseInfo.label} ({phaseInfo.monthRange})
          </p>
          <p>
            Values automatically update when the calendar phase changes. Click "Recalculate" to refresh
            immediately.
          </p>
        </div>
      </div>
    </div>
  );
}

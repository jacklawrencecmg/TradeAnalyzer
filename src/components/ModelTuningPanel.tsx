import React, { useState, useEffect } from 'react';
import { Sliders, Save, RotateCcw, Eye, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invalidateModelConfigCache } from '../lib/model/getModelConfig';

interface ConfigItem {
  key: string;
  value: number;
  category: string;
  description: string;
  min_value: number;
  max_value: number;
  updated_at: string;
  updated_by: string;
}

interface ConfigHistory {
  id: string;
  key: string;
  old_value: number;
  new_value: number;
  changed_by: string;
  created_at: string;
}

interface PreviewChange {
  player_id: string;
  player_name: string;
  position: string;
  old_value: number;
  new_value: number;
  delta: number;
  delta_percent: number;
}

export default function ModelTuningPanel() {
  const [config, setConfig] = useState<Record<string, ConfigItem>>({});
  const [changes, setChanges] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<ConfigHistory[]>([]);
  const [previewData, setPreviewData] = useState<PreviewChange[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error: configError } = await supabase
        .from('model_config')
        .select('*')
        .order('category', { ascending: true });

      if (configError) throw configError;

      const configMap: Record<string, ConfigItem> = {};
      data?.forEach((item) => {
        configMap[item.key] = item;
      });

      setConfig(configMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from('model_config_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setHistory(data);
    }
  };

  const handleChange = (key: string, value: number) => {
    setChanges((prev) => ({ ...prev, [key]: value }));
    setPreviewData(null); // Clear preview when making changes
  };

  const validateChanges = (): { valid: boolean; message?: string } => {
    const coreWeights = ['production_weight', 'age_curve_weight', 'snap_share_weight', 'depth_chart_weight'];
    const weightSum = coreWeights.reduce((sum, key) => {
      const value = changes[key] !== undefined ? changes[key] : config[key]?.value || 0;
      if (key.endsWith('_weight')) {
        return sum + value;
      }
      return sum;
    }, 0);

    if (weightSum > 1.5) {
      return {
        valid: false,
        message: `Core value weights sum to ${weightSum.toFixed(2)}, which exceeds 1.5 limit`,
      };
    }

    for (const key in changes) {
      const item = config[key];
      const value = changes[key];

      if (value < item.min_value || value > item.max_value) {
        return {
          valid: false,
          message: `${key} value ${value} is outside allowed range [${item.min_value}, ${item.max_value}]`,
        };
      }
    }

    return { valid: true };
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setError(null);

    try {
      const { data, error: previewError } = await supabase.functions.invoke(
        'model-preview',
        {
          body: { config_changes: changes },
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_ADMIN_SYNC_SECRET}`,
          },
        }
      );

      if (previewError) throw previewError;

      setPreviewData(data.top_movers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async () => {
    const validation = validateChanges();

    if (!validation.valid) {
      setError(validation.message || 'Validation failed');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      for (const key in changes) {
        const { error: updateError } = await supabase
          .from('model_config')
          .update({
            value: changes[key],
            updated_at: new Date().toISOString(),
            updated_by: 'admin',
          })
          .eq('key', key);

        if (updateError) throw updateError;
      }

      // Invalidate cache
      invalidateModelConfigCache();

      setSuccess(`Updated ${Object.keys(changes).length} config values. Rebuild will trigger automatically.`);
      setChanges({});
      setPreviewData(null);
      await loadConfig();
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = async (historyId: string, key: string) => {
    try {
      const { error: revertError } = await supabase.rpc('revert_model_config', {
        p_key: key,
        p_history_id: historyId,
        p_user_name: 'admin',
      });

      if (revertError) throw revertError;

      setSuccess(`Reverted ${key} to previous value`);
      await loadConfig();
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert');
    }
  };

  const handleReset = () => {
    setChanges({});
    setPreviewData(null);
    setError(null);
  };

  const getDisplayValue = (key: string): number => {
    return changes[key] !== undefined ? changes[key] : config[key]?.value || 0;
  };

  const hasChanges = Object.keys(changes).length > 0;

  const groupedConfig: Record<string, ConfigItem[]> = {};
  Object.values(config).forEach((item) => {
    if (!groupedConfig[item.category]) {
      groupedConfig[item.category] = [];
    }
    groupedConfig[item.category].push(item);
  });

  const categoryLabels: Record<string, string> = {
    core_value: 'Core Value Weights',
    market_behavior: 'Market Behavior',
    advice_engine: 'Advice Engine',
    league_effects: 'League Effects',
    position_scaling: 'Position Scaling',
    thresholds: 'Value Thresholds',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Sliders className="w-8 h-8 text-blue-600" />
            Live Model Tuning
          </h1>
          <p className="text-gray-600 mt-1">
            Adjust model weights and thresholds in real-time
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handlePreview}
          disabled={!hasChanges || isPreviewing}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Eye className={`w-5 h-5 ${isPreviewing ? 'animate-pulse' : ''}`} />
          {isPreviewing ? 'Previewing...' : 'Preview Changes'}
        </button>

        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className={`w-5 h-5 ${isSaving ? 'animate-spin' : ''}`} />
          {isSaving ? 'Saving...' : `Save Changes (${Object.keys(changes).length})`}
        </button>

        <button
          onClick={handleReset}
          disabled={!hasChanges}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          Reset
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-900">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-900">Success</span>
          </div>
          <p className="text-green-700 mt-1">{success}</p>
        </div>
      )}

      {/* Preview Data */}
      {previewData && previewData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Value Changes (Preview)</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Player</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-700">Position</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">Old Value</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">New Value</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-700">Change</th>
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 20).map((change) => (
                  <tr key={change.player_id} className="border-b border-gray-100">
                    <td className="py-2 px-4 font-medium text-gray-900">{change.player_name}</td>
                    <td className="py-2 px-4 text-gray-600">{change.position}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{change.old_value.toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{change.new_value.toLocaleString()}</td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {change.delta > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={change.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                          {change.delta > 0 ? '+' : ''}{change.delta.toLocaleString()} ({change.delta_percent.toFixed(1)}%)
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(groupedConfig).map(([category, items]) => (
          <div key={category} className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {categoryLabels[category] || category}
            </h2>
            <div className="space-y-6">
              {items.map((item) => {
                const currentValue = getDisplayValue(item.key);
                const hasChange = changes[item.key] !== undefined;

                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        {item.description}
                      </label>
                      <span className={`text-lg font-bold ${hasChange ? 'text-blue-600' : 'text-gray-900'}`}>
                        {currentValue.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={item.min_value}
                      max={item.max_value}
                      step={item.max_value > 10 ? 10 : 0.01}
                      value={currentValue}
                      onChange={(e) => handleChange(item.key, parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{item.min_value}</span>
                      <span>{item.max_value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Changes</h2>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-gray-600 text-center py-4">No changes yet</p>
          ) : (
            history.map((record) => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{record.key}</div>
                  <div className="text-sm text-gray-600">
                    {record.old_value.toFixed(2)} → {record.new_value.toFixed(2)}
                    <span className="mx-2">•</span>
                    {new Date(record.created_at).toLocaleString()}
                    <span className="mx-2">•</span>
                    by {record.changed_by}
                  </div>
                </div>
                <button
                  onClick={() => handleRevert(record.id, record.key)}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Revert
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

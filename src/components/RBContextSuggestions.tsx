import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw, AlertCircle, TrendingUp, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ListSkeleton } from './LoadingSkeleton';

interface Suggestion {
  id: string;
  player_id: string;
  player_name: string;
  team: string | null;
  current_depth_role: string | null;
  current_workload_tier: string | null;
  current_contract_security: string | null;
  suggested_depth_role: string | null;
  suggested_workload_tier: string | null;
  suggested_contract_security: string | null;
  confidence: number;
  reasoning: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

export default function RBContextSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('player_context_suggestions')
        .select(`
          id,
          player_id,
          suggested_depth_role,
          suggested_workload_tier,
          suggested_contract_security,
          confidence,
          reasoning,
          status,
          created_at,
          expires_at
        `)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('confidence', { ascending: false });

      if (error) throw error;

      const playerIds = data?.map(s => s.player_id) || [];
      if (playerIds.length === 0) {
        setSuggestions([]);
        return;
      }

      const { data: players, error: playersError } = await supabase
        .from('player_values')
        .select('player_id, player_name, team, depth_role, workload_tier, contract_security')
        .in('player_id', playerIds);

      if (playersError) throw playersError;

      const playersMap = new Map(players?.map(p => [p.player_id, p]) || []);

      const enriched = data?.map(s => {
        const player = playersMap.get(s.player_id);
        return {
          ...s,
          player_name: player?.player_name || 'Unknown',
          team: player?.team || null,
          current_depth_role: player?.depth_role || null,
          current_workload_tier: player?.workload_tier || null,
          current_contract_security: player?.contract_security || null,
        };
      }) || [];

      setSuggestions(enriched);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      showMessage('error', 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      setGenerating(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-rb-context-suggestions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to generate suggestions');

      const result = await response.json();
      showMessage('success', `Generated ${result.suggestions_created} suggestions`);
      await fetchSuggestions();
    } catch (err) {
      console.error('Error generating suggestions:', err);
      showMessage('error', 'Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  const acceptSuggestion = async (suggestion: Suggestion) => {
    try {
      setProcessing(suggestion.id);

      const { error: updatePlayerError } = await supabase
        .from('player_values')
        .update({
          depth_role: suggestion.suggested_depth_role,
          workload_tier: suggestion.suggested_workload_tier,
          contract_security: suggestion.suggested_contract_security,
        })
        .eq('player_id', suggestion.player_id);

      if (updatePlayerError) throw updatePlayerError;

      const { error: updateSuggestionError } = await supabase
        .from('player_context_suggestions')
        .update({ status: 'accepted' })
        .eq('id', suggestion.id);

      if (updateSuggestionError) throw updateSuggestionError;

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      showMessage('success', `Applied suggestions for ${suggestion.player_name}`);
    } catch (err) {
      console.error('Error accepting suggestion:', err);
      showMessage('error', 'Failed to apply suggestion');
    } finally {
      setProcessing(null);
    }
  };

  const ignoreSuggestion = async (suggestion: Suggestion) => {
    try {
      setProcessing(suggestion.id);

      const { error } = await supabase
        .from('player_context_suggestions')
        .update({ status: 'ignored' })
        .eq('id', suggestion.id);

      if (error) throw error;

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      showMessage('info', `Ignored suggestion for ${suggestion.player_name}`);
    } catch (err) {
      console.error('Error ignoring suggestion:', err);
      showMessage('error', 'Failed to ignore suggestion');
    } finally {
      setProcessing(null);
    }
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return { color: 'bg-green-100 text-green-800 border-green-300', label: 'High' };
    }
    if (confidence >= 0.6) {
      return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Medium' };
    }
    return { color: 'bg-gray-100 text-gray-600 border-gray-300', label: 'Low' };
  };

  const formatFieldValue = (value: string | null): string => {
    if (!value) return '-';
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'high') return s.confidence >= 0.8;
    if (filter === 'medium') return s.confidence >= 0.6 && s.confidence < 0.8;
    if (filter === 'low') return s.confidence < 0.6;
    return true;
  });

  if (loading) {
    return <ListSkeleton count={10} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">RB Context Suggestions</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review AI-generated context suggestions for running backs
          </p>
        </div>
        <button
          onClick={generateSuggestions}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Generating...' : 'Generate Suggestions'}
        </button>
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
            <CheckCircle className="w-5 h-5" />
          ) : message.type === 'error' ? (
            <AlertCircle className="w-5 h-5" />
          ) : (
            <TrendingUp className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-4 bg-white rounded-lg shadow p-4">
        <span className="text-sm font-medium text-gray-700">Filter by confidence:</span>
        <div className="flex gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-600 ml-auto">
          {filteredSuggestions.length} suggestion{filteredSuggestions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredSuggestions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Suggestions</h3>
          <p className="text-gray-600 mb-4">
            Click "Generate Suggestions" to analyze RB context data
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Player
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Current Context
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Suggested Context
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSuggestions.map((suggestion) => {
                  const confidenceBadge = getConfidenceBadge(suggestion.confidence);
                  return (
                    <tr key={suggestion.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{suggestion.player_name}</div>
                          <div className="text-sm text-gray-500">{suggestion.team || 'FA'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-medium">Role:</span>{' '}
                            <span className="text-gray-600">
                              {formatFieldValue(suggestion.current_depth_role)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Workload:</span>{' '}
                            <span className="text-gray-600">
                              {formatFieldValue(suggestion.current_workload_tier)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Contract:</span>{' '}
                            <span className="text-gray-600">
                              {formatFieldValue(suggestion.current_contract_security)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-medium">Role:</span>{' '}
                            <span className="text-blue-600 font-semibold">
                              {formatFieldValue(suggestion.suggested_depth_role)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Workload:</span>{' '}
                            <span className="text-blue-600 font-semibold">
                              {formatFieldValue(suggestion.suggested_workload_tier)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Contract:</span>{' '}
                            <span className="text-blue-600 font-semibold">
                              {formatFieldValue(suggestion.suggested_contract_security)}
                            </span>
                          </div>
                          {suggestion.reasoning && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <span className="text-xs text-gray-500 italic">
                                {suggestion.reasoning}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-semibold border ${confidenceBadge.color}`}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {confidenceBadge.label}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => acceptSuggestion(suggestion)}
                            disabled={processing === suggestion.id}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Accept
                          </button>
                          <button
                            onClick={() => ignoreSuggestion(suggestion)}
                            disabled={processing === suggestion.id}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                          >
                            <XCircle className="w-3 h-3" />
                            Ignore
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How Suggestions Work</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Context suggestions are automatically generated</strong> by analyzing team depth charts,
            player values, and dynasty trends. They help populate RB context fields faster and more consistently.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>High confidence (80%+)</strong>: Clear depth chart situations</li>
            <li><strong>Medium confidence (60-80%)</strong>: Some ambiguity or competition</li>
            <li><strong>Low confidence (&lt;60%)</strong>: Unclear or rapidly changing situations</li>
          </ul>
          <p className="mt-3">
            <strong>Note:</strong> Suggestions never overwrite manual edits. They only appear for RBs without
            existing context data. Suggestions expire after 7 days and are refreshed on each generation.
          </p>
        </div>
      </div>
    </div>
  );
}

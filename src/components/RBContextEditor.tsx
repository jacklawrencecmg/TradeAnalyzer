import { useState, useEffect } from 'react';
import { Search, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ListSkeleton } from './LoadingSkeleton';
import { getRbAdjustmentBreakdown, type RbContext } from '../lib/fdp/rbAdjustments';

interface RBPlayer {
  player_id: string;
  player_name: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  age: number | null;
  depth_role: string | null;
  workload_tier: string | null;
  injury_risk: string | null;
  contract_security: string | null;
}

export default function RBContextEditor() {
  const [rbs, setRbs] = useState<RBPlayer[]>([]);
  const [filteredRbs, setFilteredRbs] = useState<RBPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<RBPlayer | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRBs();
  }, []);

  useEffect(() => {
    filterRBs();
  }, [rbs, searchTerm]);

  const fetchRBs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .eq('position', 'RB')
        .order('ktc_value', { ascending: false });

      if (error) throw error;

      setRbs(data || []);
    } catch (err) {
      console.error('Error fetching RBs:', err);
      showMessage('error', 'Failed to load RB data');
    } finally {
      setLoading(false);
    }
  };

  const filterRBs = () => {
    if (!searchTerm) {
      setFilteredRbs(rbs);
      return;
    }

    const filtered = rbs.filter((rb) =>
      rb.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rb.team?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRbs(filtered);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const savePlayerContext = async (player: RBPlayer) => {
    try {
      setSaving(player.player_id);

      const { error } = await supabase
        .from('player_values')
        .update({
          age: player.age,
          depth_role: player.depth_role,
          workload_tier: player.workload_tier,
          injury_risk: player.injury_risk,
          contract_security: player.contract_security,
        })
        .eq('player_id', player.player_id);

      if (error) throw error;

      setRbs((prev) =>
        prev.map((rb) => (rb.player_id === player.player_id ? player : rb))
      );
      setEditingPlayer(null);
      showMessage('success', `Updated ${player.player_name}`);
    } catch (err) {
      console.error('Error saving context:', err);
      showMessage('error', 'Failed to save changes');
    } finally {
      setSaving(null);
    }
  };

  const recalculateFdpValues = async () => {
    try {
      setRecalculating(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const adminSecret = import.meta.env.VITE_ADMIN_SYNC_SECRET;

      if (!adminSecret) {
        showMessage('error', 'Admin secret not configured');
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/recalc-rb-fdp?format=dynasty_sf`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminSecret}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to recalculate FDP values');
      }

      const result = await response.json();
      showMessage('success', `Recalculated FDP values for ${result.players_updated} RBs`);
      await fetchRBs();
    } catch (err) {
      console.error('Error recalculating:', err);
      showMessage('error', 'Failed to recalculate FDP values');
    } finally {
      setRecalculating(false);
    }
  };

  const getAdjustmentPreview = (player: RBPlayer): number => {
    const ctx: RbContext = {
      age: player.age ?? undefined,
      depth_role: player.depth_role as any,
      workload_tier: player.workload_tier as any,
      injury_risk: player.injury_risk as any,
      contract_security: player.contract_security as any,
    };

    const breakdown = getRbAdjustmentBreakdown(ctx);
    return breakdown.reduce((sum, item) => sum + item.points, 0);
  };

  if (loading) {
    return <ListSkeleton count={10} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">RB Context Editor</h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure RB-specific factors for enhanced FDP value calculations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={recalculateFdpValues}
            disabled={recalculating}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating...' : 'Recalculate FDP Values'}
          </button>
          <button
            onClick={fetchRBs}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search running backs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          Showing {filteredRbs.length} running backs
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Player
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Age
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Depth Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Workload
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Injury Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Contract
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Adjustment
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRbs.map((rb) => {
                const isEditing = editingPlayer?.player_id === rb.player_id;
                const displayRb = isEditing ? editingPlayer : rb;
                const adjustment = getAdjustmentPreview(displayRb);

                return (
                  <tr key={rb.player_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{rb.player_name}</div>
                        <div className="text-sm text-gray-500">{rb.team || 'FA'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          value={displayRb.age ?? ''}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...displayRb,
                              age: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                          min="18"
                          max="45"
                        />
                      ) : (
                        <span className="text-gray-900">{displayRb.age || '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={displayRb.depth_role || ''}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...displayRb,
                              depth_role: e.target.value || null,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="">-</option>
                          <option value="feature">Feature</option>
                          <option value="lead_committee">Lead Committee</option>
                          <option value="committee">Committee</option>
                          <option value="handcuff">Handcuff</option>
                          <option value="backup">Backup</option>
                        </select>
                      ) : (
                        <span className="text-gray-900 capitalize">
                          {displayRb.depth_role?.replace('_', ' ') || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={displayRb.workload_tier || ''}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...displayRb,
                              workload_tier: e.target.value || null,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="">-</option>
                          <option value="elite">Elite</option>
                          <option value="solid">Solid</option>
                          <option value="light">Light</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      ) : (
                        <span className="text-gray-900 capitalize">
                          {displayRb.workload_tier || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={displayRb.injury_risk || ''}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...displayRb,
                              injury_risk: e.target.value || null,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="">-</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      ) : (
                        <span className="text-gray-900 capitalize">
                          {displayRb.injury_risk || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={displayRb.contract_security || ''}
                          onChange={(e) =>
                            setEditingPlayer({
                              ...displayRb,
                              contract_security: e.target.value || null,
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        >
                          <option value="">-</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      ) : (
                        <span className="text-gray-900 capitalize">
                          {displayRb.contract_security || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          adjustment > 0
                            ? 'text-green-600'
                            : adjustment < 0
                            ? 'text-red-600'
                            : 'text-gray-500'
                        }`}
                      >
                        {adjustment > 0 ? '+' : ''}
                        {adjustment}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => savePlayerContext(editingPlayer)}
                            disabled={saving === rb.player_id}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1 text-sm"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPlayer(null)}
                            disabled={saving === rb.player_id}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors disabled:opacity-50 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPlayer(rb)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Adjustment Guide</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">Age Adjustments:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>≤22: +250 (elite youth)</li>
              <li>23-24: +150 (prime youth)</li>
              <li>25: 0 (prime window)</li>
              <li>26: -300 (decline begins)</li>
              <li>27: -650 (significant concern)</li>
              <li>≥28: -1100 (high risk)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Role Adjustments:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Feature: +500</li>
              <li>Lead Committee: +200</li>
              <li>Committee: -250</li>
              <li>Handcuff: -450</li>
              <li>Backup: -700</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Workload Adjustments:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Elite (250+ touches): +350</li>
              <li>Solid (175-250): +150</li>
              <li>Light (&lt;150): -250</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Other Adjustments:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Injury Risk Medium: -150</li>
              <li>Injury Risk High: -450</li>
              <li>Contract High: +200</li>
              <li>Contract Low: -250</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

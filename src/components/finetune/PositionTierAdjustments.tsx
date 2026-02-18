import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Tier = 'elite' | 'high' | 'mid' | 'low';

interface TierRow {
  id: string;
  position: string;
  tier: Tier;
  format: string;
  adjustment_pct: number;
  is_active: boolean;
  notes: string;
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];
const TIERS: Tier[] = ['elite', 'high', 'mid', 'low'];
const FORMATS = ['all', 'dynasty_sf', 'dynasty_1qb', 'dynasty_tep'];

const TIER_COLORS: Record<Tier, string> = {
  elite: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  high:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  mid:   'bg-green-500/15 text-green-400 border-green-500/30',
  low:   'bg-fdp-surface-3 text-fdp-text-3 border-fdp-border',
};

const TIER_VALUE_RANGES: Record<Tier, string> = {
  elite: '≥8000',
  high:  '5000–7999',
  mid:   '2500–4999',
  low:   '<2500',
};

const BLANK: Omit<TierRow, 'id'> = {
  position: 'RB',
  tier: 'elite',
  format: 'all',
  adjustment_pct: 0,
  is_active: true,
  notes: '',
};

export default function PositionTierAdjustments() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<TierRow, 'id'>>(BLANK);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('position_tier_adjustments')
      .select('*')
      .order('position')
      .order('tier');
    if (!error && data) setRows(data as TierRow[]);
    setLoading(false);
  }

  async function toggleActive(row: TierRow) {
    setSaving(row.id);
    const { error } = await supabase
      .from('position_tier_adjustments')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!error) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r));
    }
    setSaving(null);
  }

  async function deleteRow(id: string) {
    const { error } = await supabase.from('position_tier_adjustments').delete().eq('id', id);
    if (!error) setRows(prev => prev.filter(r => r.id !== id));
  }

  async function updatePct(id: string, pct: number) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, adjustment_pct: pct } : r));
  }

  async function saveRow(row: TierRow) {
    setSaving(row.id);
    setStatus(null);
    const { error } = await supabase
      .from('position_tier_adjustments')
      .update({ adjustment_pct: row.adjustment_pct, notes: row.notes, updated_at: new Date().toISOString(), updated_by: 'admin' })
      .eq('id', row.id);
    if (error) {
      setStatus({ type: 'error', msg: error.message });
    } else {
      setStatus({ type: 'success', msg: 'Saved.' });
      setTimeout(() => setStatus(null), 2000);
    }
    setSaving(null);
  }

  async function addRow() {
    setSaving('new');
    setStatus(null);
    const { data, error } = await supabase
      .from('position_tier_adjustments')
      .insert({ ...draft, updated_by: 'admin' })
      .select()
      .single();
    if (error) {
      setStatus({ type: 'error', msg: error.message });
    } else {
      setRows(prev => [...prev, data as TierRow]);
      setDraft(BLANK);
      setAdding(false);
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-fdp-text-1">Position Tier Adjustments</h3>
          <p className="text-sm text-fdp-text-3 mt-0.5">
            Shift an entire value tier up or down by a percentage. Applied on top of format multipliers.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      </div>

      {status && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      {/* Tier legend */}
      <div className="flex flex-wrap gap-2">
        {TIERS.map(t => (
          <span key={t} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${TIER_COLORS[t]}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({TIER_VALUE_RANGES[t]})
          </span>
        ))}
      </div>

      {rows.length === 0 && !adding ? (
        <div className="text-center py-12 text-fdp-text-3 border border-dashed border-fdp-border rounded-xl">
          No tier adjustments defined yet. Click "Add Rule" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border transition-all ${row.is_active ? 'border-fdp-border bg-fdp-surface-2/50' : 'border-dashed border-fdp-border/50 bg-fdp-surface-2/20 opacity-60'}`}
            >
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${TIER_COLORS[row.tier as Tier]}`}>
                {row.tier}
              </span>
              <span className="text-sm font-medium text-fdp-text-1 w-8">{row.position}</span>
              <span className="text-xs text-fdp-text-3 px-2 py-0.5 bg-fdp-surface-3 rounded">
                {row.format === 'all' ? 'All Formats' : row.format.replace('dynasty_', '')}
              </span>

              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="-50"
                    max="50"
                    step="0.5"
                    value={row.adjustment_pct}
                    onChange={e => updatePct(row.id, parseFloat(e.target.value) || 0)}
                    className="w-20 text-center px-2 py-1 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500"
                  />
                  <span className={`text-sm font-semibold w-10 ${row.adjustment_pct > 0 ? 'text-green-400' : row.adjustment_pct < 0 ? 'text-red-400' : 'text-fdp-text-3'}`}>
                    {row.adjustment_pct > 0 ? '+' : ''}{row.adjustment_pct}%
                  </span>
                </div>

                <button
                  onClick={() => saveRow(row)}
                  disabled={saving === row.id}
                  className="p-1.5 rounded-lg text-fdp-text-3 hover:text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-40"
                  title="Save"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleActive(row)}
                  disabled={saving === row.id}
                  className="p-1.5 rounded-lg text-fdp-text-3 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                  title={row.is_active ? 'Disable' : 'Enable'}
                >
                  {row.is_active
                    ? <ToggleRight className="w-4 h-4 text-green-400" />
                    : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteRow(row.id)}
                  className="p-1.5 rounded-lg text-fdp-text-3 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-3">
          <p className="text-sm font-medium text-fdp-text-1">New Tier Adjustment</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Position</label>
              <select
                value={draft.position}
                onChange={e => setDraft(d => ({ ...d, position: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500"
              >
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Tier</label>
              <select
                value={draft.tier}
                onChange={e => setDraft(d => ({ ...d, tier: e.target.value as Tier }))}
                className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500"
              >
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Format</label>
              <select
                value={draft.format}
                onChange={e => setDraft(d => ({ ...d, format: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500"
              >
                {FORMATS.map(f => <option key={f} value={f}>{f === 'all' ? 'All Formats' : f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Adjustment %</label>
              <input
                type="number"
                min="-50"
                max="50"
                step="0.5"
                value={draft.adjustment_pct}
                onChange={e => setDraft(d => ({ ...d, adjustment_pct: parseFloat(e.target.value) || 0 }))}
                className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-fdp-text-3 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={draft.notes}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="e.g. Elite RBs slightly overvalued vs market"
              className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addRow}
              disabled={saving === 'new'}
              className="px-4 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >
              {saving === 'new' ? 'Adding…' : 'Add Rule'}
            </button>
            <button
              onClick={() => { setAdding(false); setDraft(BLANK); }}
              className="px-4 py-1.5 text-sm text-fdp-text-2 border border-fdp-border rounded-lg hover:bg-fdp-surface-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

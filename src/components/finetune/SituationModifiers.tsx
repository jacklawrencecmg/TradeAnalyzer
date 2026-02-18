import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type ConditionType = 'team_context' | 'usage_trend' | 'contract' | 'injury' | 'scheme';

interface ModifierRow {
  id: string;
  label: string;
  position: string;
  modifier_value: number;
  condition_type: ConditionType;
  is_active: boolean;
  notes: string;
}

const CONDITION_TYPES: ConditionType[] = ['team_context', 'usage_trend', 'contract', 'injury', 'scheme'];

const CONDITION_LABELS: Record<ConditionType, string> = {
  team_context: 'Team Context',
  usage_trend: 'Usage Trend',
  contract: 'Contract',
  injury: 'Injury',
  scheme: 'Scheme',
};

const CONDITION_COLORS: Record<ConditionType, string> = {
  team_context: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  usage_trend:  'bg-green-500/15 text-green-400 border-green-500/30',
  contract:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  injury:       'bg-red-500/15 text-red-400 border-red-500/30',
  scheme:       'bg-fdp-surface-3 text-fdp-text-2 border-fdp-border',
};

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];

const PRESET_SUGGESTIONS = [
  { label: 'Weak OL Penalty', position: 'QB', modifier_value: -300, condition_type: 'team_context' as ConditionType, notes: 'QB behind below-average OL' },
  { label: 'Elite OL Bonus', position: 'RB', modifier_value: 200, condition_type: 'team_context' as ConditionType, notes: 'RB behind elite OL' },
  { label: 'Proven Target Share Leader', position: 'WR', modifier_value: 250, condition_type: 'usage_trend' as ConditionType, notes: '25%+ target share sustained' },
  { label: 'Rising Target Share', position: 'WR', modifier_value: 150, condition_type: 'usage_trend' as ConditionType, notes: 'Trending up in targets' },
  { label: 'Scheme Fit Penalty (run-heavy)', position: 'WR', modifier_value: -200, condition_type: 'scheme' as ConditionType, notes: 'Team runs ball 60%+' },
  { label: 'Contract Year Boost', position: 'ALL', modifier_value: 100, condition_type: 'contract' as ConditionType, notes: 'Player is in a walk year' },
  { label: 'Injury History Discount', position: 'RB', modifier_value: -200, condition_type: 'injury' as ConditionType, notes: 'Two+ missed games past season' },
  { label: 'High Usage Pass Catcher TE', position: 'TE', modifier_value: 300, condition_type: 'usage_trend' as ConditionType, notes: 'TE getting 8+ targets per game' },
];

const BLANK: Omit<ModifierRow, 'id'> = {
  label: '',
  position: 'ALL',
  modifier_value: 0,
  condition_type: 'team_context',
  is_active: true,
  notes: '',
};

export default function SituationModifiers() {
  const [rows, setRows] = useState<ModifierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<ModifierRow, 'id'>>(BLANK);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [activeCondition, setActiveCondition] = useState<ConditionType | 'all'>('all');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('situation_modifiers')
      .select('*')
      .order('condition_type')
      .order('label');
    if (!error && data) setRows(data as ModifierRow[]);
    setLoading(false);
  }

  async function toggleActive(row: ModifierRow) {
    setSaving(row.id);
    const { error } = await supabase
      .from('situation_modifiers')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!error) setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r));
    setSaving(null);
  }

  async function deleteRow(id: string) {
    await supabase.from('situation_modifiers').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function saveRow(row: ModifierRow) {
    setSaving(row.id);
    setStatus(null);
    const { error } = await supabase
      .from('situation_modifiers')
      .update({ label: row.label, modifier_value: row.modifier_value, notes: row.notes, updated_at: new Date().toISOString(), updated_by: 'admin' })
      .eq('id', row.id);
    if (error) setStatus({ type: 'error', msg: error.message });
    else { setStatus({ type: 'success', msg: 'Saved.' }); setTimeout(() => setStatus(null), 2000); }
    setSaving(null);
  }

  async function addRow(data: Omit<ModifierRow, 'id'> = draft) {
    setSaving('new');
    setStatus(null);
    const { data: inserted, error } = await supabase
      .from('situation_modifiers')
      .insert({ ...data, updated_by: 'admin' })
      .select()
      .single();
    if (error) setStatus({ type: 'error', msg: error.message });
    else { setRows(prev => [...prev, inserted as ModifierRow]); setDraft(BLANK); setAdding(false); }
    setSaving(null);
  }

  const filtered = activeCondition === 'all' ? rows : rows.filter(r => r.condition_type === activeCondition);

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
          <h3 className="text-base font-semibold text-fdp-text-1">Situation Modifiers</h3>
          <p className="text-sm text-fdp-text-3 mt-0.5">
            Flat point adjustments for player context: team situation, usage patterns, scheme fit, injuries, and contracts.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Modifier
        </button>
      </div>

      {status && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCondition('all')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCondition === 'all' ? 'bg-fdp-text-1 text-fdp-bg-1' : 'text-fdp-text-3 hover:text-fdp-text-1 border border-fdp-border'}`}
        >
          All ({rows.length})
        </button>
        {CONDITION_TYPES.map(ct => {
          const count = rows.filter(r => r.condition_type === ct).length;
          return (
            <button
              key={ct}
              onClick={() => setActiveCondition(ct)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${activeCondition === ct ? `${CONDITION_COLORS[ct]} font-semibold` : 'text-fdp-text-3 border-fdp-border hover:text-fdp-text-1'}`}
            >
              {CONDITION_LABELS[ct]} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Preset suggestions when adding */}
      {adding && (
        <div className="p-4 rounded-xl border border-fdp-border bg-fdp-surface-2/50 space-y-3">
          <p className="text-sm font-medium text-fdp-text-1">Quick Presets</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_SUGGESTIONS.map(p => (
              <button
                key={p.label}
                onClick={() => setDraft({ ...p, is_active: true })}
                className="px-2.5 py-1 rounded-lg text-xs border border-fdp-border text-fdp-text-2 hover:border-orange-500/50 hover:text-fdp-text-1 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && !adding ? (
        <div className="text-center py-12 text-fdp-text-3 border border-dashed border-fdp-border rounded-xl">
          No situation modifiers defined. Click "Add Modifier" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(row => (
            <div
              key={row.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border transition-all ${row.is_active ? 'border-fdp-border bg-fdp-surface-2/50' : 'border-dashed border-fdp-border/50 bg-fdp-surface-2/20 opacity-60'}`}
            >
              <Tag className="w-3.5 h-3.5 text-fdp-text-3 shrink-0" />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={row.label}
                  onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))}
                  className="text-sm font-medium text-fdp-text-1 bg-transparent focus:outline-none focus:underline w-full"
                />
                {row.notes && <p className="text-xs text-fdp-text-3 truncate">{row.notes}</p>}
              </div>

              <span className={`px-2 py-0.5 rounded-full text-xs border ${CONDITION_COLORS[row.condition_type]}`}>
                {CONDITION_LABELS[row.condition_type]}
              </span>
              <span className="text-xs font-medium text-fdp-text-2 px-1.5 py-0.5 bg-fdp-surface-3 rounded">
                {row.position}
              </span>

              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="-5000"
                  max="5000"
                  step="50"
                  value={row.modifier_value}
                  onChange={e => setRows(prev => prev.map(r => r.id === row.id ? { ...r, modifier_value: parseInt(e.target.value) || 0 } : r))}
                  className="w-20 text-center px-2 py-1 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500"
                />
                <span className={`text-sm font-semibold w-14 ${row.modifier_value > 0 ? 'text-green-400' : row.modifier_value < 0 ? 'text-red-400' : 'text-fdp-text-3'}`}>
                  {row.modifier_value > 0 ? '+' : ''}{row.modifier_value.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => saveRow(row)} disabled={saving === row.id} className="p-1.5 rounded-lg text-fdp-text-3 hover:text-orange-400 hover:bg-orange-500/10 transition-colors" title="Save">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleActive(row)} disabled={saving === row.id} className="p-1.5 rounded-lg text-fdp-text-3 transition-colors" title={row.is_active ? 'Disable' : 'Enable'}>
                  {row.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => deleteRow(row.id)} className="p-1.5 rounded-lg text-fdp-text-3 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-3">
          <p className="text-sm font-medium text-fdp-text-1">New Situation Modifier</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-fdp-text-3 mb-1 block">Label</label>
              <input
                type="text"
                value={draft.label}
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Weak OL Penalty"
                className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Position</label>
              <select value={draft.position} onChange={e => setDraft(d => ({ ...d, position: e.target.value }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500">
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Type</label>
              <select value={draft.condition_type} onChange={e => setDraft(d => ({ ...d, condition_type: e.target.value as ConditionType }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500">
                {CONDITION_TYPES.map(ct => <option key={ct} value={ct}>{CONDITION_LABELS[ct]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Value (pts)</label>
              <input type="number" min="-5000" max="5000" step="50" value={draft.modifier_value} onChange={e => setDraft(d => ({ ...d, modifier_value: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs text-fdp-text-3 mb-1 block">Notes</label>
              <input type="text" value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="When to apply this modifier…" className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addRow()} disabled={!draft.label || saving === 'new'} className="px-4 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors">
              {saving === 'new' ? 'Adding…' : 'Add Modifier'}
            </button>
            <button onClick={() => { setAdding(false); setDraft(BLANK); }} className="px-4 py-1.5 text-sm text-fdp-text-2 border border-fdp-border rounded-lg hover:bg-fdp-surface-2 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

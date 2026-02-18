import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BulkRow {
  id: string;
  label: string;
  position: string;
  min_age: number | null;
  max_age: number | null;
  format: string;
  adjustment_pct: number;
  adjustment_flat: number;
  is_active: boolean;
  priority: number;
  notes: string;
}

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB'];
const FORMATS = ['all', 'dynasty_sf', 'dynasty_1qb', 'dynasty_tep'];

const PRESET_RULES: Omit<BulkRow, 'id'>[] = [
  { label: 'Aging RB Discount (28+)', position: 'RB', min_age: 28, max_age: null, format: 'all', adjustment_pct: -12, adjustment_flat: 0, is_active: false, priority: 10, notes: 'Age cliff for RBs 28 and older' },
  { label: 'Young RB Premium (≤22)', position: 'RB', min_age: null, max_age: 22, format: 'all', adjustment_pct: 5, adjustment_flat: 0, is_active: false, priority: 10, notes: 'Upside premium for young RBs' },
  { label: 'Veteran QB Discount (34+)', position: 'QB', min_age: 34, max_age: null, format: 'all', adjustment_pct: -8, adjustment_flat: 0, is_active: false, priority: 10, notes: 'Late-career QB age penalty' },
  { label: 'Peak TE Boost (25–29)', position: 'TE', min_age: 25, max_age: 29, format: 'dynasty_tep', adjustment_pct: 6, adjustment_flat: 0, is_active: false, priority: 10, notes: 'TEP premium for TEs in their prime window' },
  { label: 'Rookie WR Discount (22–)', position: 'WR', min_age: null, max_age: 22, format: 'all', adjustment_pct: -5, adjustment_flat: 0, is_active: false, priority: 10, notes: 'New-to-league adjustment before targets materialize' },
  { label: 'SF QB Overall Lift', position: 'QB', min_age: null, max_age: null, format: 'dynasty_sf', adjustment_pct: 3, adjustment_flat: 0, is_active: false, priority: 20, notes: 'Subtle boost to all QBs in Superflex formats' },
];

const BLANK: Omit<BulkRow, 'id'> = {
  label: '',
  position: 'ALL',
  min_age: null,
  max_age: null,
  format: 'all',
  adjustment_pct: 0,
  adjustment_flat: 0,
  is_active: true,
  priority: 10,
  notes: '',
};

function ageLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Any age';
  if (min !== null && max !== null) return `Age ${min}–${max}`;
  if (min !== null) return `Age ${min}+`;
  return `Age ≤${max}`;
}

export default function BulkAdjustments() {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<BulkRow, 'id'>>(BLANK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('bulk_adjustments')
      .select('*')
      .order('priority')
      .order('label');
    if (!error && data) setRows(data as BulkRow[]);
    setLoading(false);
  }

  async function toggleActive(row: BulkRow) {
    setSaving(row.id);
    const { error } = await supabase
      .from('bulk_adjustments')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!error) setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r));
    setSaving(null);
  }

  async function deleteRow(id: string) {
    await supabase.from('bulk_adjustments').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function saveRow(row: BulkRow) {
    setSaving(row.id);
    setStatus(null);
    const { error } = await supabase
      .from('bulk_adjustments')
      .update({
        label: row.label, adjustment_pct: row.adjustment_pct, adjustment_flat: row.adjustment_flat,
        min_age: row.min_age, max_age: row.max_age, notes: row.notes, priority: row.priority,
        updated_at: new Date().toISOString(), updated_by: 'admin'
      })
      .eq('id', row.id);
    if (error) setStatus({ type: 'error', msg: error.message });
    else { setStatus({ type: 'success', msg: 'Saved.' }); setTimeout(() => setStatus(null), 2000); }
    setSaving(null);
  }

  async function addPreset(preset: Omit<BulkRow, 'id'>) {
    setSaving('new');
    const { data, error } = await supabase
      .from('bulk_adjustments')
      .insert({ ...preset, updated_by: 'admin' })
      .select()
      .single();
    if (!error && data) setRows(prev => [...prev, data as BulkRow]);
    setSaving(null);
  }

  async function addRow() {
    setSaving('new');
    setStatus(null);
    const { data, error } = await supabase
      .from('bulk_adjustments')
      .insert({ ...draft, updated_by: 'admin' })
      .select()
      .single();
    if (error) setStatus({ type: 'error', msg: error.message });
    else { setRows(prev => [...prev, data as BulkRow]); setDraft(BLANK); setAdding(false); }
    setSaving(null);
  }

  function updateRow(id: string, field: keyof BulkRow, value: any) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  const activeRows = rows.filter(r => r.is_active);
  const inactiveRows = rows.filter(r => !r.is_active);

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
          <h3 className="text-base font-semibold text-fdp-text-1">Bulk Adjustments</h3>
          <p className="text-sm text-fdp-text-3 mt-0.5">
            Apply percentage and/or flat adjustments to player segments by position, age range, and format.
            Rules are applied in priority order (lower = first).
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

      {/* Stats bar */}
      {rows.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span><span className="font-semibold text-green-400">{activeRows.length}</span> <span className="text-fdp-text-3">active</span></span>
          <span><span className="font-semibold text-fdp-text-3">{inactiveRows.length}</span> <span className="text-fdp-text-3">inactive</span></span>
          <span><span className="font-semibold text-fdp-text-1">{rows.length}</span> <span className="text-fdp-text-3">total</span></span>
        </div>
      )}

      {/* Preset loader */}
      {rows.length === 0 && !adding && (
        <div className="p-4 rounded-xl border border-fdp-border bg-fdp-surface-2/50 space-y-3">
          <p className="text-sm font-medium text-fdp-text-1">Suggested Starter Rules</p>
          <div className="grid gap-2">
            {PRESET_RULES.map(p => (
              <div key={p.label} className="flex items-center justify-between px-3 py-2 rounded-lg border border-fdp-border bg-fdp-surface-2/40">
                <div>
                  <p className="text-sm font-medium text-fdp-text-1">{p.label}</p>
                  <p className="text-xs text-fdp-text-3">{p.position} · {ageLabel(p.min_age, p.max_age)} · {p.format === 'all' ? 'All formats' : p.format}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${p.adjustment_pct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {p.adjustment_pct > 0 ? '+' : ''}{p.adjustment_pct}%
                  </span>
                  <button
                    onClick={() => addPreset(p)}
                    disabled={saving === 'new'}
                    className="px-2.5 py-1 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-colors disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active rows */}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.id}
              className={`rounded-xl border transition-all ${row.is_active ? 'border-fdp-border bg-fdp-surface-2/50' : 'border-dashed border-fdp-border/50 bg-fdp-surface-2/20 opacity-60'}`}
            >
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-fdp-text-3 bg-fdp-surface-3 px-1.5 py-0.5 rounded">P{row.priority}</span>
                    <span className="text-sm font-medium text-fdp-text-1 truncate">{row.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-fdp-surface-3 text-fdp-text-2">{row.position}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-fdp-surface-3 text-fdp-text-2">{ageLabel(row.min_age, row.max_age)}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-fdp-surface-3 text-fdp-text-2">{row.format === 'all' ? 'All Formats' : row.format.replace('dynasty_', '')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {row.adjustment_pct !== 0 && (
                    <span className={`text-sm font-semibold ${row.adjustment_pct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {row.adjustment_pct > 0 ? '+' : ''}{row.adjustment_pct}%
                    </span>
                  )}
                  {row.adjustment_flat !== 0 && (
                    <span className={`text-sm font-semibold ${row.adjustment_flat > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {row.adjustment_flat > 0 ? '+' : ''}{row.adjustment_flat.toLocaleString()}pts
                    </span>
                  )}
                  {row.adjustment_pct === 0 && row.adjustment_flat === 0 && (
                    <span className="text-sm text-fdp-text-3">0</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="p-1.5 rounded-lg text-fdp-text-3 hover:text-fdp-text-1 transition-colors">
                    {expanded === row.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => saveRow(row)} disabled={saving === row.id} className="p-1.5 rounded-lg text-fdp-text-3 hover:text-orange-400 hover:bg-orange-500/10 transition-colors">
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleActive(row)} disabled={saving === row.id} className="p-1.5 rounded-lg">
                    {row.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-fdp-text-3" />}
                  </button>
                  <button onClick={() => deleteRow(row.id)} className="p-1.5 rounded-lg text-fdp-text-3 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expanded === row.id && (
                <div className="px-4 pb-4 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-fdp-border/50">
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Label</label>
                    <input type="text" value={row.label} onChange={e => updateRow(row.id, 'label', e.target.value)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Adj % (pct)</label>
                    <input type="number" min="-80" max="80" step="0.5" value={row.adjustment_pct} onChange={e => updateRow(row.id, 'adjustment_pct', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Adj Flat (pts)</label>
                    <input type="number" min="-5000" max="5000" step="50" value={row.adjustment_flat} onChange={e => updateRow(row.id, 'adjustment_flat', parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Priority</label>
                    <input type="number" min="1" max="100" value={row.priority} onChange={e => updateRow(row.id, 'priority', parseInt(e.target.value) || 10)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Min Age</label>
                    <input type="number" min="18" max="45" value={row.min_age ?? ''} onChange={e => updateRow(row.id, 'min_age', e.target.value ? parseInt(e.target.value) : null)} placeholder="None" className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Max Age</label>
                    <input type="number" min="18" max="45" value={row.max_age ?? ''} onChange={e => updateRow(row.id, 'max_age', e.target.value ? parseInt(e.target.value) : null)} placeholder="None" className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Format</label>
                    <select value={row.format} onChange={e => updateRow(row.id, 'format', e.target.value)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500">
                      {FORMATS.map(f => <option key={f} value={f}>{f === 'all' ? 'All Formats' : f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-fdp-text-3 mb-1 block">Position</label>
                    <select value={row.position} onChange={e => updateRow(row.id, 'position', e.target.value)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500">
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-xs text-fdp-text-3 mb-1 block">Notes</label>
                    <input type="text" value={row.notes} onChange={e => updateRow(row.id, 'notes', e.target.value)} className="w-full px-2 py-1 rounded border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-fdp-text-1">New Bulk Adjustment Rule</p>
            <span className="text-xs text-fdp-text-3">Or choose a preset above</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-fdp-text-3 mb-1 block">Label</label>
              <input type="text" value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder="e.g. Aging RB Discount" className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Position</label>
              <select value={draft.position} onChange={e => setDraft(d => ({ ...d, position: e.target.value }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500">
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Format</label>
              <select value={draft.format} onChange={e => setDraft(d => ({ ...d, format: e.target.value }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm text-fdp-text-1 focus:outline-none focus:border-orange-500">
                {FORMATS.map(f => <option key={f} value={f}>{f === 'all' ? 'All Formats' : f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Min Age</label>
              <input type="number" min="18" max="45" value={draft.min_age ?? ''} onChange={e => setDraft(d => ({ ...d, min_age: e.target.value ? parseInt(e.target.value) : null }))} placeholder="None" className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Max Age</label>
              <input type="number" min="18" max="45" value={draft.max_age ?? ''} onChange={e => setDraft(d => ({ ...d, max_age: e.target.value ? parseInt(e.target.value) : null }))} placeholder="None" className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Adj %</label>
              <input type="number" min="-80" max="80" step="0.5" value={draft.adjustment_pct} onChange={e => setDraft(d => ({ ...d, adjustment_pct: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-fdp-text-3 mb-1 block">Flat Pts</label>
              <input type="number" min="-5000" max="5000" step="50" value={draft.adjustment_flat} onChange={e => setDraft(d => ({ ...d, adjustment_flat: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 rounded-lg border border-fdp-border bg-fdp-surface-2 text-sm font-mono text-fdp-text-1 focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRow} disabled={!draft.label || saving === 'new'} className="px-4 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors">
              {saving === 'new' ? 'Adding…' : 'Add Rule'}
            </button>
            <button onClick={() => { setAdding(false); setDraft(BLANK); }} className="px-4 py-1.5 text-sm text-fdp-text-2 border border-fdp-border rounded-lg hover:bg-fdp-surface-2 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

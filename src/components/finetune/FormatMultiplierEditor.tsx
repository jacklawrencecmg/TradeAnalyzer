import { useState, useEffect } from 'react';
import { Save, RotateCcw, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type LeagueFormat = 'dynasty_sf' | 'dynasty_1qb' | 'dynasty_tep';
type Position = 'QB' | 'RB' | 'WR' | 'TE';

interface MultiplierRow {
  id: string;
  format: LeagueFormat;
  position: Position;
  multiplier: number;
  is_active: boolean;
  notes: string;
}

const FORMAT_LABELS: Record<LeagueFormat, string> = {
  dynasty_sf: 'Superflex (SF)',
  dynasty_1qb: '1QB',
  dynasty_tep: 'TE Premium (TEP)',
};

const POS_COLORS: Record<Position, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
};

const FORMATS: LeagueFormat[] = ['dynasty_sf', 'dynasty_1qb', 'dynasty_tep'];
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];

const DEFAULT_MULTIPLIERS: Record<LeagueFormat, Record<Position, number>> = {
  dynasty_sf:  { QB: 1.35, RB: 1.15, WR: 1.00, TE: 1.10 },
  dynasty_1qb: { QB: 1.00, RB: 1.18, WR: 1.00, TE: 1.10 },
  dynasty_tep: { QB: 1.35, RB: 1.15, WR: 1.00, TE: 1.25 },
};

export default function FormatMultiplierEditor() {
  const [rows, setRows] = useState<MultiplierRow[]>([]);
  const [staged, setStaged] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('format_multiplier_overrides')
      .select('*')
      .order('format')
      .order('position');
    if (!error && data) setRows(data as MultiplierRow[]);
    setLoading(false);
  }

  function key(format: LeagueFormat, pos: Position) {
    return `${format}__${pos}`;
  }

  function getValue(format: LeagueFormat, pos: Position): number {
    const k = key(format, pos);
    if (k in staged) return staged[k];
    const row = rows.find(r => r.format === format && r.position === pos);
    return row?.multiplier ?? DEFAULT_MULTIPLIERS[format][pos];
  }

  function handleChange(format: LeagueFormat, pos: Position, val: number) {
    setStaged(prev => ({ ...prev, [key(format, pos)]: val }));
  }

  function resetToDefaults() {
    const defaults: Record<string, number> = {};
    for (const fmt of FORMATS) {
      for (const pos of POSITIONS) {
        defaults[key(fmt, pos)] = DEFAULT_MULTIPLIERS[fmt][pos];
      }
    }
    setStaged(defaults);
  }

  async function save() {
    if (Object.keys(staged).length === 0) return;
    setSaving(true);
    setStatus(null);
    try {
      for (const [k, multiplier] of Object.entries(staged)) {
        const [format, position] = k.split('__');
        const { error } = await supabase
          .from('format_multiplier_overrides')
          .upsert({ format, position, multiplier, updated_by: 'admin', updated_at: new Date().toISOString() }, { onConflict: 'format,position' });
        if (error) throw error;
      }
      setStatus({ type: 'success', msg: `Saved ${Object.keys(staged).length} multiplier(s).` });
      setStaged({});
      await load();
    } catch (e: any) {
      setStatus({ type: 'error', msg: e.message });
    } finally {
      setSaving(false);
    }
  }

  const hasStagedChanges = Object.keys(staged).length > 0;

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
          <h3 className="text-base font-semibold text-fdp-text-1">Format Multipliers</h3>
          <p className="text-sm text-fdp-text-3 mt-0.5">
            Controls how much each position's KTC base value is scaled per league format. WR at 1.00 = baseline.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-fdp-text-2 border border-fdp-border rounded-lg hover:bg-fdp-surface-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Defaults
          </button>
          <button
            onClick={save}
            disabled={!hasStagedChanges || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-fdp-border">
              <th className="text-left py-2 pr-4 text-fdp-text-3 font-medium">Format</th>
              {POSITIONS.map(pos => (
                <th key={pos} className={`text-center py-2 px-3 font-semibold ${POS_COLORS[pos]}`}>{pos}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FORMATS.map((fmt, fi) => (
              <tr key={fmt} className={fi % 2 === 0 ? 'bg-fdp-surface-2/30' : ''}>
                <td className="py-3 pr-4 font-medium text-fdp-text-1 whitespace-nowrap">{FORMAT_LABELS[fmt]}</td>
                {POSITIONS.map(pos => {
                  const val = getValue(fmt, pos);
                  const def = DEFAULT_MULTIPLIERS[fmt][pos];
                  const isDirty = key(fmt, pos) in staged && staged[key(fmt, pos)] !== def;
                  const delta = val - def;
                  return (
                    <td key={pos} className="py-3 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="number"
                          min="0.1"
                          max="5.0"
                          step="0.01"
                          value={val}
                          onChange={e => handleChange(fmt, pos, parseFloat(e.target.value) || def)}
                          className={`w-20 text-center px-2 py-1.5 rounded-lg border text-sm font-mono transition-colors
                            ${isDirty
                              ? 'border-orange-500/60 bg-orange-500/5 text-fdp-text-1'
                              : 'border-fdp-border bg-fdp-surface-2 text-fdp-text-1'
                            } focus:outline-none focus:border-orange-500`}
                        />
                        {isDirty && (
                          <span className={`text-xs font-medium ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-fdp-text-3'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                          </span>
                        )}
                        {!isDirty && (
                          <span className="text-xs text-fdp-text-3">×{def.toFixed(2)}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 px-3 py-2.5 bg-fdp-surface-2 rounded-lg border border-fdp-border text-xs text-fdp-text-3">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Multipliers apply directly to the KTC base value. Example: a QB with KTC=7000 in Superflex (1.35×) = 9,450 FDP.
          Changes here are saved to the database but <strong className="text-fdp-text-2">do not automatically rebuild all player values</strong> — trigger a rebuild from Admin Sync after saving.
        </span>
      </div>
    </div>
  );
}

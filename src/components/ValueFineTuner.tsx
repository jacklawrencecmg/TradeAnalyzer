import { useState } from 'react';
import { Sliders, Layers, Tag, Users, RefreshCw, Info } from 'lucide-react';
import FormatMultiplierEditor from './finetune/FormatMultiplierEditor';
import PositionTierAdjustments from './finetune/PositionTierAdjustments';
import SituationModifiers from './finetune/SituationModifiers';
import BulkAdjustments from './finetune/BulkAdjustments';

type Panel = 'multipliers' | 'tiers' | 'situations' | 'bulk';

interface PanelDef {
  id: Panel;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
}

const PANELS: PanelDef[] = [
  {
    id: 'multipliers',
    label: 'Format Multipliers',
    shortLabel: 'Multipliers',
    icon: Sliders,
    description: 'Edit per-format, per-position KTC multipliers (SF, 1QB, TEP)',
  },
  {
    id: 'tiers',
    label: 'Tier Adjustments',
    shortLabel: 'Tiers',
    icon: Layers,
    description: 'Shift entire value tiers (Elite / High / Mid / Low) up or down by %',
  },
  {
    id: 'situations',
    label: 'Situation Modifiers',
    shortLabel: 'Situations',
    icon: Tag,
    description: 'Flat-point context modifiers: team, usage, scheme, contract, injury',
  },
  {
    id: 'bulk',
    label: 'Bulk Adjustments',
    shortLabel: 'Bulk',
    icon: Users,
    description: 'Apply % or flat adjustments to player segments by position, age, or format',
  },
];

export default function ValueFineTuner() {
  const [active, setActive] = useState<Panel>('multipliers');

  const current = PANELS.find(p => p.id === active)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-fdp-text-1">Value Fine-Tuner</h2>
          </div>
          <p className="text-sm text-fdp-text-3">
            Calibrate player values across four layers. Changes are saved to the database.
            Trigger a rebuild from <strong className="text-fdp-text-2">Admin Sync</strong> to propagate updates.
          </p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'ktcAdmin' }))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-fdp-text-2 border border-fdp-border rounded-lg hover:bg-fdp-surface-2 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Go to Rebuild
        </button>
      </div>

      {/* Pipeline diagram */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-fdp-text-3 px-3 py-2.5 bg-fdp-surface-2 rounded-xl border border-fdp-border">
        <Info className="w-3.5 h-3.5 shrink-0 text-fdp-text-3" />
        <span className="font-medium text-fdp-text-2">Calculation order:</span>
        <span className="px-2 py-0.5 bg-fdp-surface-3 rounded text-fdp-text-2">KTC Base</span>
        <span>→</span>
        <span className="px-2 py-0.5 bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded font-medium">Format ×</span>
        <span>→</span>
        <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded font-medium">Tier %</span>
        <span>→</span>
        <span className="px-2 py-0.5 bg-green-500/15 text-green-400 border border-green-500/20 rounded font-medium">Situation pts</span>
        <span>→</span>
        <span className="px-2 py-0.5 bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded font-medium">Bulk %+pts</span>
        <span>→</span>
        <span className="px-2 py-0.5 bg-fdp-surface-3 rounded text-fdp-text-2">FDP Value</span>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-fdp-surface-2 rounded-xl border border-fdp-border">
        {PANELS.map(panel => {
          const Icon = panel.icon;
          const isActive = panel.id === active;
          return (
            <button
              key={panel.id}
              onClick={() => setActive(panel.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-fdp-bg-1 text-fdp-text-1 shadow-sm'
                  : 'text-fdp-text-3 hover:text-fdp-text-2 hover:bg-fdp-surface-2/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : ''}`} />
              <span className="hidden sm:inline">{panel.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Panel description */}
      <div className="px-3 py-2 rounded-lg bg-fdp-surface-2/50 border border-fdp-border">
        <p className="text-xs text-fdp-text-3">
          <span className="font-semibold text-fdp-text-2">{current.label} — </span>
          {current.description}
        </p>
      </div>

      {/* Active panel */}
      <div className="p-4 rounded-xl border border-fdp-border bg-fdp-surface-2/30">
        {active === 'multipliers' && <FormatMultiplierEditor />}
        {active === 'tiers' && <PositionTierAdjustments />}
        {active === 'situations' && <SituationModifiers />}
        {active === 'bulk' && <BulkAdjustments />}
      </div>
    </div>
  );
}

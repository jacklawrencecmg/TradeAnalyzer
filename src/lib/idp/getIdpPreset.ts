export type IDPScoringPreset = 'tackle_heavy' | 'balanced' | 'big_play';

export function getIdpPreset(format: string): IDPScoringPreset {
  const normalized = format.toLowerCase().replace(/-/g, '_');

  if (normalized.includes('bigplay') || normalized.includes('big_play')) {
    return 'big_play';
  }

  if (normalized.includes('balanced')) {
    return 'balanced';
  }

  return 'tackle_heavy';
}

export function getPresetDescription(preset: IDPScoringPreset): string {
  const descriptions: Record<IDPScoringPreset, string> = {
    tackle_heavy: 'Emphasizes consistent tackle production (1pt/tackle, minimal big play bonuses)',
    balanced: 'Equal weight across all defensive stats (standard IDP scoring)',
    big_play: 'Rewards sacks, INTs, forced fumbles (heavy big play bonuses, low tackle points)',
  };
  return descriptions[preset];
}

export function getPresetLabel(preset: IDPScoringPreset): string {
  const labels: Record<IDPScoringPreset, string> = {
    tackle_heavy: 'Tackle Heavy',
    balanced: 'Balanced',
    big_play: 'Big Play',
  };
  return labels[preset];
}

export function getFormatWithPreset(baseFormat: string, preset: IDPScoringPreset): string {
  const base = baseFormat.replace(/_tackle|_balanced|_bigplay|_big_play/gi, '');

  if (preset === 'big_play') {
    return `${base}_bigplay`;
  }
  if (preset === 'balanced') {
    return `${base}_balanced`;
  }
  return `${base}_tackle`;
}

export function isIDPFormat(format: string): boolean {
  return format.toLowerCase().includes('idp');
}

export function getBaseFormat(format: string): string {
  return format.replace(/_tackle|_balanced|_bigplay|_big_play/gi, '');
}

export function getAllIDPPresets(): IDPScoringPreset[] {
  return ['tackle_heavy', 'balanced', 'big_play'];
}

export function getPresetIcon(preset: IDPScoringPreset): string {
  const icons: Record<IDPScoringPreset, string> = {
    tackle_heavy: '📊',
    balanced: '⚖️',
    big_play: '💥',
  };
  return icons[preset];
}

export function getPresetColor(preset: IDPScoringPreset): string {
  const colors: Record<IDPScoringPreset, string> = {
    tackle_heavy: '#3B82F6',
    balanced: '#10B981',
    big_play: '#F59E0B',
  };
  return colors[preset];
}

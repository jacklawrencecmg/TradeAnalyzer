import { Top1000PlayerWithRedraft } from '../build/fillRedraftValues';

export interface CsvExportRow {
  rank_overall: number;
  player_name: string;
  team: string;
  pos: string;
  subpos: string;
  value_dynasty: number;
  value_redraft: number;
  redraft_flavor: 'ppr' | 'half';
  value_source: string;
  as_of_date: string;
}

export function exportTop1000PprCsv(
  players: Top1000PlayerWithRedraft[]
): string {
  const today = new Date().toISOString().split('T')[0];

  const headers = [
    'rank_overall',
    'player_name',
    'team',
    'pos',
    'subpos',
    'value_dynasty',
    'value_redraft',
    'redraft_flavor',
    'value_source',
    'as_of_date',
  ];

  const rows = [headers.join(',')];

  for (const player of players) {
    const valueSource = `${player.dynasty_source}+${player.redraft_source_ppr}`;

    const row = [
      player.rank_overall,
      `"${player.player_name.replace(/"/g, '""')}"`,
      player.team,
      player.pos,
      player.subpos || '',
      player.value_dynasty,
      player.value_redraft_ppr,
      'ppr',
      valueSource,
      today,
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export function exportTop1000HalfCsv(
  players: Top1000PlayerWithRedraft[]
): string {
  const today = new Date().toISOString().split('T')[0];

  const headers = [
    'rank_overall',
    'player_name',
    'team',
    'pos',
    'subpos',
    'value_dynasty',
    'value_redraft',
    'redraft_flavor',
    'value_source',
    'as_of_date',
  ];

  const rows = [headers.join(',')];

  for (const player of players) {
    const valueSource = `${player.dynasty_source}+${player.redraft_source_half}`;

    const row = [
      player.rank_overall,
      `"${player.player_name.replace(/"/g, '""')}"`,
      player.team,
      player.pos,
      player.subpos || '',
      player.value_dynasty,
      player.value_redraft_half,
      'half',
      valueSource,
      today,
    ];

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

export function exportTop1000CombinedCsv(
  players: Top1000PlayerWithRedraft[]
): string {
  const today = new Date().toISOString().split('T')[0];

  const headers = [
    'rank_overall',
    'player_name',
    'team',
    'pos',
    'subpos',
    'value_dynasty',
    'value_redraft',
    'redraft_flavor',
    'value_source',
    'as_of_date',
  ];

  const rows = [headers.join(',')];

  for (const player of players) {
    const pprValueSource = `${player.dynasty_source}+${player.redraft_source_ppr}`;
    const halfValueSource = `${player.dynasty_source}+${player.redraft_source_half}`;

    const pprRow = [
      player.rank_overall,
      `"${player.player_name.replace(/"/g, '""')}"`,
      player.team,
      player.pos,
      player.subpos || '',
      player.value_dynasty,
      player.value_redraft_ppr,
      'ppr',
      pprValueSource,
      today,
    ];

    const halfRow = [
      player.rank_overall,
      `"${player.player_name.replace(/"/g, '""')}"`,
      player.team,
      player.pos,
      player.subpos || '',
      player.value_dynasty,
      player.value_redraft_half,
      'half',
      halfValueSource,
      today,
    ];

    rows.push(pprRow.join(','));
    rows.push(halfRow.join(','));
  }

  return rows.join('\n');
}

export function createCsvBlob(csvText: string): Blob {
  return new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
}

export function downloadCsv(csvText: string, filename: string): void {
  const blob = createCsvBlob(csvText);
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

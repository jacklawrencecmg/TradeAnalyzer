export interface NormalizedPlayer {
  source: 'fantasypros';
  list_type: 'dynasty_overall' | 'dynasty_superflex' | 'idp' | 'dl' | 'lb' | 'db';
  rank: number;
  full_name: string;
  team: string;
  pos: string;
  bye_week?: number;
}

/**
 * Detect header row and find column indices
 */
function detectHeaders(rows: string[][]): {
  rankCol: number;
  nameCol: number;
  teamCol: number;
  posCol: number;
  byeCol: number;
} {
  const headerRow = rows[0] || [];

  // Common header variations
  const rankHeaders = ['rank', 'rnk', '#', 'overall'];
  const nameHeaders = ['player', 'name', 'player name'];
  const teamHeaders = ['team', 'tm'];
  const posHeaders = ['pos', 'position'];
  const byeHeaders = ['bye', 'bye week'];

  const findCol = (possibleHeaders: string[]): number => {
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i].toLowerCase().trim();
      if (possibleHeaders.some((h) => header.includes(h))) {
        return i;
      }
    }
    return -1;
  };

  return {
    rankCol: findCol(rankHeaders),
    nameCol: findCol(nameHeaders),
    teamCol: findCol(teamHeaders),
    posCol: findCol(posHeaders),
    byeCol: findCol(byeHeaders),
  };
}

/**
 * Clean player name (remove notes, suffixes)
 */
function cleanPlayerName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '') // Remove parentheses
    .replace(/\s+Note.*$/i, '') // Remove notes
    .replace(/\s*-\s*.*$/, '') // Remove dashes and everything after
    .replace(/[*†‡]/g, '') // Remove special markers
    .trim();
}

/**
 * Extract team from combined field (e.g., "KC - RB" or "DEN")
 */
function extractTeam(teamField: string): string {
  return teamField
    .split('-')[0]
    .split('(')[0]
    .trim()
    .toUpperCase();
}

/**
 * Normalize position
 */
function normalizePosition(pos: string, listType: string): string {
  const cleaned = pos.toUpperCase().trim();

  // IDP positions
  if (listType === 'dl' || cleaned === 'DL' || cleaned === 'DE' || cleaned === 'DT') {
    return 'DL';
  }
  if (listType === 'lb' || cleaned === 'LB') {
    return 'LB';
  }
  if (
    listType === 'db' ||
    cleaned === 'DB' ||
    cleaned === 'CB' ||
    cleaned === 'S' ||
    cleaned === 'SAF'
  ) {
    return 'DB';
  }

  // Offensive positions
  if (cleaned === 'QB') return 'QB';
  if (cleaned === 'RB') return 'RB';
  if (cleaned === 'WR') return 'WR';
  if (cleaned === 'TE') return 'TE';

  return cleaned;
}

/**
 * Normalize rows from FantasyPros CSV
 */
export function normalizeFantasyProsRows(
  rows: string[][],
  listType: string
): NormalizedPlayer[] {
  if (rows.length === 0) return [];

  const headers = detectHeaders(rows);
  const normalized: NormalizedPlayer[] = [];

  // Start from row 1 (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row.length < 3) continue; // Skip invalid rows

    try {
      // Extract rank
      let rank = 0;
      if (headers.rankCol >= 0 && row[headers.rankCol]) {
        rank = parseInt(row[headers.rankCol].replace(/\D/g, ''), 10) || 0;
      } else {
        // Use row index as rank if not found
        rank = i;
      }

      // Extract name
      let fullName = '';
      if (headers.nameCol >= 0 && row[headers.nameCol]) {
        fullName = cleanPlayerName(row[headers.nameCol]);
      } else {
        // Try first column that looks like a name
        fullName = cleanPlayerName(row[0] || '');
      }

      if (!fullName) continue; // Skip if no name

      // Extract team
      let team = '';
      if (headers.teamCol >= 0 && row[headers.teamCol]) {
        team = extractTeam(row[headers.teamCol]);
      } else {
        // Try to find team in name field or other columns
        for (const field of row) {
          const match = field.match(/\b([A-Z]{2,3})\b/);
          if (match && match[1].length <= 3) {
            team = match[1];
            break;
          }
        }
      }

      // Extract position
      let pos = '';
      if (headers.posCol >= 0 && row[headers.posCol]) {
        pos = normalizePosition(row[headers.posCol], listType);
      } else {
        // Try to infer from list type
        if (listType === 'dl') pos = 'DL';
        else if (listType === 'lb') pos = 'LB';
        else if (listType === 'db') pos = 'DB';
        else {
          // Try to find position in other columns
          for (const field of row) {
            if (/^(QB|RB|WR|TE|DL|LB|DB|DE|DT|CB|S)$/i.test(field)) {
              pos = normalizePosition(field, listType);
              break;
            }
          }
        }
      }

      // Extract bye week if available
      let byeWeek: number | undefined;
      if (headers.byeCol >= 0 && row[headers.byeCol]) {
        const bye = parseInt(row[headers.byeCol], 10);
        if (!isNaN(bye) && bye > 0 && bye <= 18) {
          byeWeek = bye;
        }
      }

      normalized.push({
        source: 'fantasypros',
        list_type: listType as any,
        rank,
        full_name: fullName,
        team: team || 'FA',
        pos: pos || 'FLEX',
        bye_week: byeWeek,
      });
    } catch (error) {
      console.warn(`Error normalizing row ${i}:`, error);
      continue;
    }
  }

  return normalized;
}

/**
 * Merge duplicate players (keep highest ranked)
 */
export function deduplicatePlayers(players: NormalizedPlayer[]): NormalizedPlayer[] {
  const seen = new Map<string, NormalizedPlayer>();

  for (const player of players) {
    const key = `${player.full_name.toLowerCase()}_${player.pos}_${player.team}`;
    const existing = seen.get(key);

    if (!existing || player.rank < existing.rank) {
      seen.set(key, player);
    }
  }

  return Array.from(seen.values());
}

/**
 * Sort players by rank
 */
export function sortByRank(players: NormalizedPlayer[]): NormalizedPlayer[] {
  return players.sort((a, b) => a.rank - b.rank);
}

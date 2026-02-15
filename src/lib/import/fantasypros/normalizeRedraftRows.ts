import { normalizeName } from '../../players/normalizeName';

export interface NormalizedRedraftPlayer {
  source: 'fantasypros';
  list_type: 'redraft_ppr' | 'redraft_half_ppr' | 'redraft_standard' | 'adp_ppr';
  rank: number;
  full_name: string;
  normalized_name: string;
  team: string | null;
  pos: string;
  bye_week?: number;
}

/**
 * Detect header row and find column indices
 */
function detectRedraftHeaders(rows: string[][]): {
  rankCol: number;
  nameCol: number;
  teamCol: number;
  posCol: number;
  byeCol: number;
  adpCol: number;
} {
  const headerRow = rows[0] || [];

  // Common header variations
  const rankHeaders = ['rank', 'rnk', '#', 'overall'];
  const nameHeaders = ['player', 'name', 'player name'];
  const teamHeaders = ['team', 'tm'];
  const posHeaders = ['pos', 'position'];
  const byeHeaders = ['bye', 'bye week'];
  const adpHeaders = ['adp', 'avg pick', 'average pick'];

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
    adpCol: findCol(adpHeaders),
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
function extractTeam(teamField: string): string | null {
  if (!teamField) return null;

  const cleaned = teamField
    .split('-')[0]
    .split('(')[0]
    .trim()
    .toUpperCase();

  // Check if it looks like a valid team abbreviation (2-3 letters)
  if (cleaned.length >= 2 && cleaned.length <= 3) {
    return cleaned;
  }

  return null;
}

/**
 * Normalize position
 */
function normalizePosition(pos: string): string {
  const cleaned = pos.toUpperCase().trim();

  // Offensive positions
  if (cleaned === 'QB') return 'QB';
  if (cleaned === 'RB') return 'RB';
  if (cleaned === 'WR') return 'WR';
  if (cleaned === 'TE') return 'TE';
  if (cleaned === 'K' || cleaned === 'PK') return 'K';

  // IDP positions (rare in redraft but possible)
  if (cleaned === 'DL' || cleaned === 'DE' || cleaned === 'DT') return 'DL';
  if (cleaned === 'LB') return 'LB';
  if (cleaned === 'DB' || cleaned === 'CB' || cleaned === 'S' || cleaned === 'SAF') return 'DB';

  return cleaned;
}

/**
 * Normalize redraft rows from FantasyPros CSV
 */
export function normalizeRedraftRows(
  rows: string[][],
  listType: string
): NormalizedRedraftPlayer[] {
  if (rows.length === 0) return [];

  const headers = detectRedraftHeaders(rows);
  const normalized: NormalizedRedraftPlayer[] = [];

  // Start from row 1 (skip header)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row.length < 3) continue; // Skip invalid rows

    try {
      // Extract rank (or ADP)
      let rank = 0;
      if (headers.rankCol >= 0 && row[headers.rankCol]) {
        rank = parseInt(row[headers.rankCol].replace(/\D/g, ''), 10) || 0;
      } else if (headers.adpCol >= 0 && row[headers.adpCol]) {
        // Use ADP as rank
        const adp = parseFloat(row[headers.adpCol]);
        if (!isNaN(adp)) {
          rank = Math.round(adp);
        }
      }

      if (!rank || rank === 0) {
        // Use row index as fallback
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

      // Normalize name for matching
      const normalizedName = normalizeName(fullName);

      // Extract team
      let team: string | null = null;
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
        pos = normalizePosition(row[headers.posCol]);
      } else {
        // Try to find position in other columns
        for (const field of row) {
          if (/^(QB|RB|WR|TE|K|PK|DL|LB|DB|DE|DT|CB|S)$/i.test(field)) {
            pos = normalizePosition(field);
            break;
          }
        }
      }

      if (!pos) {
        // If we can't find position, skip this row
        continue;
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
        normalized_name: normalizedName,
        team,
        pos,
        bye_week: byeWeek,
      });
    } catch (error) {
      console.warn(`Error normalizing redraft row ${i}:`, error);
      continue;
    }
  }

  return normalized;
}

/**
 * Create a lookup map for quick matching
 */
export function createRedraftLookup(
  players: NormalizedRedraftPlayer[]
): Map<string, NormalizedRedraftPlayer> {
  const lookup = new Map<string, NormalizedRedraftPlayer>();

  for (const player of players) {
    // Primary key: normalized_name + pos
    const primaryKey = `${player.normalized_name}_${player.pos}`;
    if (!lookup.has(primaryKey) || player.rank < lookup.get(primaryKey)!.rank) {
      lookup.set(primaryKey, player);
    }

    // Secondary key: just normalized_name (for cross-position matching)
    const secondaryKey = player.normalized_name;
    if (!lookup.has(secondaryKey) || player.rank < lookup.get(secondaryKey)!.rank) {
      lookup.set(secondaryKey, player);
    }

    // Tertiary key: normalized_name + team (if available)
    if (player.team) {
      const tertiaryKey = `${player.normalized_name}_${player.team}`;
      if (!lookup.has(tertiaryKey) || player.rank < lookup.get(tertiaryKey)!.rank) {
        lookup.set(tertiaryKey, player);
      }
    }
  }

  return lookup;
}

/**
 * Match a dynasty player to a redraft player
 */
export function matchRedraftPlayer(
  dynastyName: string,
  dynastyPos: string,
  dynastyTeam: string | undefined,
  redraftLookup: Map<string, NormalizedRedraftPlayer>
): NormalizedRedraftPlayer | null {
  const normalizedDynastyName = normalizeName(dynastyName);

  // Strategy 1: Exact match on normalized_name + pos
  const primaryKey = `${normalizedDynastyName}_${dynastyPos}`;
  if (redraftLookup.has(primaryKey)) {
    return redraftLookup.get(primaryKey)!;
  }

  // Strategy 2: Match on normalized_name + team (if available)
  if (dynastyTeam) {
    const tertiaryKey = `${normalizedDynastyName}_${dynastyTeam}`;
    if (redraftLookup.has(tertiaryKey)) {
      return redraftLookup.get(tertiaryKey)!;
    }
  }

  // Strategy 3: Match on just normalized_name (cross-position fallback)
  if (redraftLookup.has(normalizedDynastyName)) {
    return redraftLookup.get(normalizedDynastyName)!;
  }

  return null;
}

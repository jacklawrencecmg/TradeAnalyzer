export interface ParsedPlayer {
  rank: number;
  full_name: string;
  team: string | null;
  pos: string;
  subpos?: string | null;
  bye_week?: number;
  adp?: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }

  fields.push(currentField.trim());
  return fields;
}

function detectHeaders(
  rows: string[][]
): {
  rankCol: number;
  nameCol: number;
  teamCol: number;
  posCol: number;
  byeCol: number;
  adpCol: number;
} {
  const headerRow = rows[0] || [];

  const rankHeaders = ['rank', 'rnk', '#', 'overall', 'rk'];
  const nameHeaders = ['player', 'name', 'player name', 'playername'];
  const teamHeaders = ['team', 'tm', 'nfl team'];
  const posHeaders = ['pos', 'position', 'positions'];
  const byeHeaders = ['bye', 'bye week', 'byeweek'];
  const adpHeaders = ['adp', 'avg pick', 'average pick', 'avg. pick'];

  const findCol = (possibleHeaders: string[]): number => {
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i].toLowerCase().trim();
      if (possibleHeaders.some((h) => header === h || header.includes(h))) {
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

function cleanPlayerName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+Note.*$/i, '')
    .replace(/\s*-\s*.*$/, '')
    .replace(/[*†‡]/g, '')
    .trim();
}

function extractTeam(field: string): string | null {
  if (!field) return null;

  const cleaned = field.split('-')[0].split('(')[0].trim().toUpperCase();

  if (cleaned.length >= 2 && cleaned.length <= 3 && /^[A-Z]+$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function normalizePosition(pos: string): string {
  const cleaned = pos.toUpperCase().trim();

  if (cleaned === 'QB') return 'QB';
  if (cleaned === 'RB') return 'RB';
  if (cleaned === 'WR') return 'WR';
  if (cleaned === 'TE') return 'TE';
  if (cleaned === 'K' || cleaned === 'PK') return 'K';

  if (cleaned === 'DL' || cleaned === 'DE' || cleaned === 'DT') return 'DL';
  if (cleaned === 'LB') return 'LB';
  if (cleaned === 'DB' || cleaned === 'CB' || cleaned === 'S' || cleaned === 'SAF')
    return 'DB';

  return cleaned;
}

function inferPositionFromName(name: string, existingPos?: string): string {
  if (existingPos) return existingPos;

  const lower = name.toLowerCase();

  if (lower.includes('(qb)')) return 'QB';
  if (lower.includes('(rb)')) return 'RB';
  if (lower.includes('(wr)')) return 'WR';
  if (lower.includes('(te)')) return 'TE';
  if (lower.includes('(k)')) return 'K';
  if (lower.includes('(dl)') || lower.includes('(de)') || lower.includes('(dt)'))
    return 'DL';
  if (lower.includes('(lb)')) return 'LB';
  if (lower.includes('(db)') || lower.includes('(cb)') || lower.includes('(s)'))
    return 'DB';

  return 'UNKNOWN';
}

export function parseFantasyProsCsv(csvText: string): ParsedPlayer[] {
  const lines = csvText.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return [];

  const rows = lines.map((line) => parseCsvLine(line));

  const headers = detectHeaders(rows);
  const players: ParsedPlayer[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (row.length < 2) continue;

    try {
      let rank = 0;
      if (headers.rankCol >= 0 && row[headers.rankCol]) {
        rank = parseInt(row[headers.rankCol].replace(/\D/g, ''), 10) || 0;
      }

      if (!rank || rank === 0) {
        rank = i;
      }

      let fullName = '';
      if (headers.nameCol >= 0 && row[headers.nameCol]) {
        fullName = cleanPlayerName(row[headers.nameCol]);
      } else {
        fullName = cleanPlayerName(row[0] || '');
      }

      if (!fullName) continue;

      let team: string | null = null;
      if (headers.teamCol >= 0 && row[headers.teamCol]) {
        team = extractTeam(row[headers.teamCol]);
      } else {
        for (const field of row) {
          const extracted = extractTeam(field);
          if (extracted) {
            team = extracted;
            break;
          }
        }
      }

      let pos = '';
      if (headers.posCol >= 0 && row[headers.posCol]) {
        pos = normalizePosition(row[headers.posCol]);
      } else {
        for (const field of row) {
          if (/^(QB|RB|WR|TE|K|PK|DL|LB|DB|DE|DT|CB|S)$/i.test(field)) {
            pos = normalizePosition(field);
            break;
          }
        }
      }

      pos = inferPositionFromName(fullName, pos);

      if (pos === 'UNKNOWN' || !pos) {
        continue;
      }

      let byeWeek: number | undefined;
      if (headers.byeCol >= 0 && row[headers.byeCol]) {
        const bye = parseInt(row[headers.byeCol], 10);
        if (!isNaN(bye) && bye > 0 && bye <= 18) {
          byeWeek = bye;
        }
      }

      let adp: number | undefined;
      if (headers.adpCol >= 0 && row[headers.adpCol]) {
        const adpVal = parseFloat(row[headers.adpCol]);
        if (!isNaN(adpVal) && adpVal > 0) {
          adp = adpVal;
        }
      }

      const subpos =
        pos === 'DL' || pos === 'LB' || pos === 'DB' ? pos : undefined;

      players.push({
        rank,
        full_name: fullName,
        team,
        pos,
        subpos,
        bye_week: byeWeek,
        adp,
      });
    } catch (error) {
      console.warn(`Error parsing row ${i}:`, error);
      continue;
    }
  }

  return players;
}

export function parseCsvText(csvText: string): string[][] {
  const lines = csvText.split('\n').filter((line) => line.trim());
  return lines.map((line) => parseCsvLine(line));
}

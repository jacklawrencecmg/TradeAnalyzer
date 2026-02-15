import { normalizeName } from '../players/normalizeName';

export interface PlayerToMatch {
  full_name: string;
  pos: string;
  team?: string | null;
}

export interface MatchResult<T> {
  matched: boolean;
  player: T | null;
  matchType: 'exact' | 'name_pos' | 'name_team' | 'name_only' | 'none';
  confidence: number;
}

export function createMatchKey(name: string, pos?: string, team?: string): string {
  const normalized = normalizeName(name);

  if (pos && team) {
    return `${normalized}|${pos.toUpperCase()}|${team.toUpperCase()}`;
  } else if (pos) {
    return `${normalized}|${pos.toUpperCase()}`;
  } else if (team) {
    return `${normalized}|${team.toUpperCase()}`;
  } else {
    return normalized;
  }
}

export function createPlayerLookup<T extends PlayerToMatch>(
  players: T[]
): Map<string, T> {
  const lookup = new Map<string, T>();

  for (const player of players) {
    const normalized = normalizeName(player.full_name);

    const exactKey = createMatchKey(player.full_name, player.pos, player.team || undefined);
    if (!lookup.has(exactKey)) {
      lookup.set(exactKey, player);
    }

    const namePosKey = `${normalized}|${player.pos.toUpperCase()}`;
    if (!lookup.has(namePosKey)) {
      lookup.set(namePosKey, player);
    }

    if (player.team) {
      const nameTeamKey = `${normalized}|${player.team.toUpperCase()}`;
      if (!lookup.has(nameTeamKey)) {
        lookup.set(nameTeamKey, player);
      }
    }

    if (!lookup.has(normalized)) {
      lookup.set(normalized, player);
    }
  }

  return lookup;
}

export function matchPlayer<T extends PlayerToMatch>(
  targetName: string,
  targetPos: string,
  targetTeam: string | null | undefined,
  lookup: Map<string, T>
): MatchResult<T> {
  const normalized = normalizeName(targetName);

  const exactKey = createMatchKey(targetName, targetPos, targetTeam || undefined);
  if (lookup.has(exactKey)) {
    return {
      matched: true,
      player: lookup.get(exactKey)!,
      matchType: 'exact',
      confidence: 1.0,
    };
  }

  const namePosKey = `${normalized}|${targetPos.toUpperCase()}`;
  if (lookup.has(namePosKey)) {
    const match = lookup.get(namePosKey)!;
    const confidence = targetTeam && match.team === targetTeam ? 0.95 : 0.90;
    return {
      matched: true,
      player: match,
      matchType: 'name_pos',
      confidence,
    };
  }

  if (targetTeam) {
    const nameTeamKey = `${normalized}|${targetTeam.toUpperCase()}`;
    if (lookup.has(nameTeamKey)) {
      return {
        matched: true,
        player: lookup.get(nameTeamKey)!,
        matchType: 'name_team',
        confidence: 0.85,
      };
    }
  }

  if (lookup.has(normalized)) {
    return {
      matched: true,
      player: lookup.get(normalized)!,
      matchType: 'name_only',
      confidence: 0.75,
    };
  }

  return {
    matched: false,
    player: null,
    matchType: 'none',
    confidence: 0,
  };
}

export function matchPlayersBatch<T extends PlayerToMatch, S extends PlayerToMatch>(
  targets: S[],
  sourcePool: T[]
): Map<S, MatchResult<T>> {
  const lookup = createPlayerLookup(sourcePool);
  const results = new Map<S, MatchResult<T>>();

  for (const target of targets) {
    const result = matchPlayer(
      target.full_name,
      target.pos,
      target.team,
      lookup
    );
    results.set(target, result);
  }

  return results;
}

export function warnDuplicateTeams<T extends PlayerToMatch>(
  players: T[]
): Map<string, T[]> {
  const byNamePos = new Map<string, T[]>();

  for (const player of players) {
    const key = `${normalizeName(player.full_name)}|${player.pos}`;
    if (!byNamePos.has(key)) {
      byNamePos.set(key, []);
    }
    byNamePos.get(key)!.push(player);
  }

  const duplicates = new Map<string, T[]>();

  for (const [key, group] of byNamePos.entries()) {
    if (group.length > 1) {
      const teams = new Set(group.map(p => p.team).filter(Boolean));
      if (teams.size > 1) {
        console.warn(
          `⚠️  Player ${group[0].full_name} (${group[0].pos}) appears with multiple teams:`,
          [...teams].join(', ')
        );
        duplicates.set(key, group);
      }
    }
  }

  return duplicates;
}

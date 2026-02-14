import { supabase } from '../supabase';
import { normalizeName, scoreMatch, calculateTokenOverlap } from './normalizeName';

export interface ResolveOptions {
  name: string;
  position?: string;
  team?: string;
  source?: string;
  fuzzyThreshold?: number;
  maxSuggestions?: number;
  autoQuarantine?: boolean;
}

export interface PlayerMatch {
  player_id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  status: string;
  match_type: 'exact' | 'alias' | 'fuzzy' | 'suggested';
  match_score: number;
  matched_via?: string;
}

export interface ResolveResult {
  success: boolean;
  player_id?: string;
  match?: PlayerMatch;
  suggestions?: PlayerMatch[];
  quarantined?: boolean;
  quarantine_id?: string;
  error?: string;
}

export async function resolvePlayerId(options: ResolveOptions): Promise<ResolveResult> {
  const {
    name,
    position,
    team,
    source = 'user',
    fuzzyThreshold = 0.7,
    maxSuggestions = 5,
    autoQuarantine = true,
  } = options;

  if (!name || name.trim().length === 0) {
    return {
      success: false,
      error: 'Name is required',
    };
  }

  const normalized = normalizeName(name);

  if (normalized.length === 0) {
    return {
      success: false,
      error: 'Name could not be normalized',
    };
  }

  const exactMatch = await tryExactMatch(normalized, position);
  if (exactMatch) {
    return {
      success: true,
      player_id: exactMatch.player_id,
      match: exactMatch,
    };
  }

  const aliasMatch = await tryAliasMatch(normalized, position);
  if (aliasMatch) {
    return {
      success: true,
      player_id: aliasMatch.player_id,
      match: aliasMatch,
    };
  }

  const fuzzyMatches = await tryFuzzyMatch(name, position, team, fuzzyThreshold, maxSuggestions);

  if (fuzzyMatches.length === 1 && fuzzyMatches[0].match_score >= 85) {
    return {
      success: true,
      player_id: fuzzyMatches[0].player_id,
      match: fuzzyMatches[0],
    };
  }

  if (fuzzyMatches.length > 0) {
    let quarantine_id: string | undefined;

    if (autoQuarantine) {
      quarantine_id = await quarantineUnresolved(name, position, team, source, fuzzyMatches);
    }

    return {
      success: false,
      suggestions: fuzzyMatches,
      quarantined: autoQuarantine,
      quarantine_id,
      error: 'Ambiguous match - multiple suggestions found',
    };
  }

  if (autoQuarantine) {
    const quarantine_id = await quarantineUnresolved(name, position, team, source, []);

    return {
      success: false,
      suggestions: [],
      quarantined: true,
      quarantine_id,
      error: 'No matches found',
    };
  }

  return {
    success: false,
    suggestions: [],
    error: 'No matches found',
  };
}

async function tryExactMatch(normalized: string, position?: string): Promise<PlayerMatch | null> {
  try {
    let query = supabase
      .from('nfl_players')
      .select('id, full_name, player_position, team, status')
      .eq('search_name', normalized);

    if (position) {
      query = query.eq('player_position', position);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      player_id: data.id,
      full_name: data.full_name,
      player_position: data.player_position,
      team: data.team,
      status: data.status,
      match_type: 'exact',
      match_score: 100,
      matched_via: 'nfl_players.search_name',
    };
  } catch (err) {
    console.error('Error in exact match:', err);
    return null;
  }
}

async function tryAliasMatch(normalized: string, position?: string): Promise<PlayerMatch | null> {
  try {
    const { data, error } = await supabase
      .from('player_aliases')
      .select(`
        player_id,
        alias,
        nfl_players!inner (
          id,
          full_name,
          player_position,
          team,
          status
        )
      `)
      .eq('alias_normalized', normalized)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const player = data.nfl_players as any;

    if (position && player.player_position !== position) {
      return null;
    }

    return {
      player_id: player.id,
      full_name: player.full_name,
      player_position: player.player_position,
      team: player.team,
      status: player.status,
      match_type: 'alias',
      match_score: 95,
      matched_via: `alias: ${data.alias}`,
    };
  } catch (err) {
    console.error('Error in alias match:', err);
    return null;
  }
}

async function tryFuzzyMatch(
  name: string,
  position?: string,
  team?: string,
  threshold: number = 0.7,
  limit: number = 5
): Promise<PlayerMatch[]> {
  try {
    let query = supabase
      .from('nfl_players')
      .select('id, full_name, player_position, team, status')
      .in('status', ['Active', 'Rookie', 'Practice Squad', 'Injured Reserve', 'IR', 'Free Agent']);

    if (position) {
      query = query.eq('player_position', position);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    const scored = data
      .map(player => {
        const score = scoreMatch(
          name,
          player.full_name,
          player.player_position,
          player.team,
          position,
          team
        );

        const overlap = calculateTokenOverlap(name, player.full_name);

        return {
          player_id: player.id,
          full_name: player.full_name,
          player_position: player.player_position,
          team: player.team,
          status: player.status,
          match_type: 'fuzzy' as const,
          match_score: score,
          overlap,
        };
      })
      .filter(match => match.overlap >= threshold || match.match_score >= 70)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    return scored.map(({ overlap, ...match }) => match);
  } catch (err) {
    console.error('Error in fuzzy match:', err);
    return [];
  }
}

async function quarantineUnresolved(
  rawName: string,
  position?: string,
  team?: string,
  source: string = 'user',
  suggestions: PlayerMatch[] = []
): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('unresolved_entities')
      .insert({
        raw_name: rawName,
        player_position: position || null,
        team: team || null,
        source,
        status: 'open',
        suggestions: suggestions.map(s => ({
          player_id: s.player_id,
          full_name: s.full_name,
          position: s.player_position,
          team: s.team,
          score: s.match_score,
        })),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error quarantining unresolved entity:', error);
      return undefined;
    }

    return data.id;
  } catch (err) {
    console.error('Error in quarantine:', err);
    return undefined;
  }
}

export async function resolveBatch(
  names: Array<{ name: string; position?: string; team?: string }>,
  options?: Partial<ResolveOptions>
): Promise<Map<string, ResolveResult>> {
  const results = new Map<string, ResolveResult>();

  for (const { name, position, team } of names) {
    const result = await resolvePlayerId({
      name,
      position,
      team,
      ...options,
    });

    results.set(name, result);
  }

  return results;
}

export async function addManualAlias(
  playerId: string,
  alias: string,
  source: string = 'user'
): Promise<boolean> {
  try {
    const normalized = normalizeName(alias);

    if (!normalized) {
      return false;
    }

    const { error } = await supabase.rpc('add_player_alias', {
      p_player_id: playerId,
      p_alias: alias,
      p_alias_normalized: normalized,
      p_source: source,
    });

    if (error) {
      console.error('Error adding manual alias:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in addManualAlias:', err);
    return false;
  }
}

export async function resolveQuarantinedEntity(
  entityId: string,
  playerId: string,
  createAlias: boolean = true
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('resolve_unresolved_entity', {
      p_entity_id: entityId,
      p_player_id: playerId,
      p_create_alias: createAlias,
    });

    if (error) {
      console.error('Error resolving entity:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Error in resolveQuarantinedEntity:', err);
    return false;
  }
}

export async function ignoreQuarantinedEntity(entityId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('ignore_unresolved_entity', {
      p_entity_id: entityId,
    });

    if (error) {
      console.error('Error ignoring entity:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Error in ignoreQuarantinedEntity:', err);
    return false;
  }
}

export async function getUnresolvedEntities(status: string = 'open', limit: number = 100) {
  try {
    const { data, error } = await supabase
      .from('unresolved_entities')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching unresolved entities:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getUnresolvedEntities:', err);
    return [];
  }
}

export async function getPlayerAliases(playerId: string) {
  try {
    const { data, error } = await supabase.rpc('get_player_aliases', {
      p_player_id: playerId,
    });

    if (error) {
      console.error('Error fetching player aliases:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error in getPlayerAliases:', err);
    return [];
  }
}

export async function testResolver(name: string, position?: string, team?: string) {
  console.log('Testing resolver for:', { name, position, team });

  const result = await resolvePlayerId({
    name,
    position,
    team,
    autoQuarantine: false,
  });

  console.log('Resolve result:', result);

  return result;
}

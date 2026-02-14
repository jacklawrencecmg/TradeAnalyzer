import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface ResolveOptions {
  name: string;
  position?: string;
  team?: string;
  source?: string;
  fuzzyThreshold?: number;
  autoQuarantine?: boolean;
}

interface PlayerMatch {
  player_id: string;
  full_name: string;
  player_position: string;
  team: string | null;
  status: string;
  match_type: 'exact' | 'alias' | 'fuzzy';
  match_score: number;
  matched_via?: string;
}

interface ResolveResult {
  success: boolean;
  player_id?: string;
  match?: PlayerMatch;
  suggestions?: PlayerMatch[];
  quarantined?: boolean;
  quarantine_id?: string;
  error?: string;
}

function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  let normalized = name.trim().toLowerCase();
  normalized = normalized.replace(/'/g, '');
  normalized = normalized.replace(/\./g, ' ');
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'junior', 'senior'];
  const words = normalized.split(' ');
  const filteredWords = words.filter(word => word.length > 0 && !suffixes.includes(word));
  normalized = filteredWords.join(' ');

  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/\s+/g, '');

  return normalized;
}

function tokenize(name: string): string[] {
  const withSpaces = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withSpaces.split(' ').filter(Boolean);
}

function calculateTokenOverlap(name1: string, name2: string): number {
  const tokens1 = new Set(tokenize(name1));
  const tokens2 = new Set(tokenize(name2));

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

function scoreMatch(
  query: string,
  candidateName: string,
  candidatePosition?: string,
  candidateTeam?: string,
  queryPosition?: string,
  queryTeam?: string
): number {
  let score = 0;

  const queryNorm = normalizeName(query);
  const candidateNorm = normalizeName(candidateName);

  if (queryNorm === candidateNorm) {
    score += 100;
  } else if (candidateNorm.startsWith(queryNorm)) {
    score += 90;
  } else if (candidateNorm.includes(queryNorm)) {
    score += 80;
  } else {
    const overlap = calculateTokenOverlap(query, candidateName);
    score += Math.floor(overlap * 70);
  }

  if (queryPosition && candidatePosition) {
    if (queryPosition.toLowerCase() === candidatePosition.toLowerCase()) {
      score += 20;
    }
  }

  if (queryTeam && candidateTeam) {
    if (queryTeam.toLowerCase() === candidateTeam.toLowerCase()) {
      score += 10;
    }
  }

  return score;
}

async function tryExactMatch(
  supabase: SupabaseClient,
  normalized: string,
  position?: string
): Promise<PlayerMatch | null> {
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

async function tryAliasMatch(
  supabase: SupabaseClient,
  normalized: string,
  position?: string
): Promise<PlayerMatch | null> {
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  rawName: string,
  position?: string,
  team?: string,
  source: string = 'ktc',
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

export async function resolvePlayerId(
  supabase: SupabaseClient,
  options: ResolveOptions
): Promise<ResolveResult> {
  const {
    name,
    position,
    team,
    source = 'ktc',
    fuzzyThreshold = 0.7,
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

  const exactMatch = await tryExactMatch(supabase, normalized, position);
  if (exactMatch) {
    return {
      success: true,
      player_id: exactMatch.player_id,
      match: exactMatch,
    };
  }

  const aliasMatch = await tryAliasMatch(supabase, normalized, position);
  if (aliasMatch) {
    return {
      success: true,
      player_id: aliasMatch.player_id,
      match: aliasMatch,
    };
  }

  const fuzzyMatches = await tryFuzzyMatch(supabase, name, position, team, fuzzyThreshold, 5);

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
      quarantine_id = await quarantineUnresolved(supabase, name, position, team, source, fuzzyMatches);
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
    const quarantine_id = await quarantineUnresolved(supabase, name, position, team, source, []);

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

export async function addPlayerAlias(
  supabase: SupabaseClient,
  playerId: string,
  alias: string,
  source: string = 'ktc'
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
      console.error('Error adding alias:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in addPlayerAlias:', err);
    return false;
  }
}

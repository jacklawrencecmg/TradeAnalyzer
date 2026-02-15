/**
 * Player Name Normalization
 *
 * Normalizes player names for consistent matching across data sources.
 * Handles:
 * - Case differences (Tyreek Hill vs TYREEK HILL)
 * - Punctuation (D'Brickashaw vs DBrickashaw)
 * - Suffixes (Jr., Sr., II, III, IV)
 * - Spacing variations
 * - Nicknames
 */

export interface NormalizedName {
  original: string;
  normalized: string;
  tokens: string[];
  firstInitial: string;
  lastName: string;
}

/**
 * Normalize player name for matching
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '') // Remove suffixes
    .trim();
}

/**
 * Get detailed normalized name with tokens
 */
export function getNormalizedName(name: string): NormalizedName {
  const normalized = normalizeName(name);
  const tokens = normalized.split(' ').filter((t) => t.length > 0);

  const firstInitial = tokens[0]?.[0] || '';
  const lastName = tokens[tokens.length - 1] || '';

  return {
    original: name,
    normalized,
    tokens,
    firstInitial,
    lastName,
  };
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1)
 * 1 = identical, 0 = completely different
 */
export function nameSimilarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0.0;

  const maxLength = Math.max(normA.length, normB.length);
  const distance = levenshteinDistance(normA, normB);

  return 1 - distance / maxLength;
}

/**
 * Check if names are likely the same person
 * Uses multiple heuristics
 */
export function areNamesSimilar(
  name1: string,
  name2: string,
  threshold: number = 0.92
): boolean {
  const sim = nameSimilarity(name1, name2);
  return sim >= threshold;
}

/**
 * Extract first and last name
 */
export function extractFirstLast(
  name: string
): { first: string; last: string } | null {
  const normalized = getNormalizedName(name);

  if (normalized.tokens.length === 0) return null;

  if (normalized.tokens.length === 1) {
    return { first: '', last: normalized.tokens[0] };
  }

  return {
    first: normalized.tokens[0],
    last: normalized.tokens[normalized.tokens.length - 1],
  };
}

/**
 * Check if name matches first initial + last name pattern
 * Example: "T.Hill" matches "Tyreek Hill"
 */
export function matchesInitialLastName(
  fullName: string,
  pattern: string
): boolean {
  const full = getNormalizedName(fullName);
  const pat = getNormalizedName(pattern);

  if (pat.tokens.length === 0) return false;

  // Check for "T Hill" or "T.Hill" pattern
  if (pat.tokens.length === 1) {
    // Pattern is just last name
    return full.lastName === pat.tokens[0];
  }

  if (pat.tokens.length === 2) {
    const [firstPart, lastPart] = pat.tokens;

    // Check if first part is single letter (initial)
    if (firstPart.length === 1) {
      return firstPart === full.firstInitial && lastPart === full.lastName;
    }
  }

  return false;
}

/**
 * Common name variations and nicknames
 */
const NICKNAME_MAP: Record<string, string[]> = {
  william: ['will', 'bill', 'billy'],
  robert: ['rob', 'bob', 'bobby'],
  richard: ['rick', 'dick', 'ricky'],
  michael: ['mike', 'mikey'],
  christopher: ['chris'],
  anthony: ['tony'],
  theodore: ['ted', 'teddy'],
  alexander: ['alex'],
  benjamin: ['ben', 'benji'],
  daniel: ['dan', 'danny'],
  edward: ['ed', 'eddie'],
  joseph: ['joe', 'joey'],
  kenneth: ['ken', 'kenny'],
  thomas: ['tom', 'tommy'],
  timothy: ['tim', 'timmy'],
  andrew: ['andy', 'drew'],
  matthew: ['matt'],
  nathaniel: ['nate', 'nathan'],
  samuel: ['sam', 'sammy'],
  charles: ['charlie', 'chuck'],
};

/**
 * Check if two names could be the same person (accounting for nicknames)
 */
export function couldBeNickname(name1: string, name2: string): boolean {
  const n1 = getNormalizedName(name1);
  const n2 = getNormalizedName(name2);

  // Check each token
  for (const token1 of n1.tokens) {
    for (const token2 of n2.tokens) {
      if (token1 === token2) continue;

      // Check if one is a nickname of the other
      for (const [formal, nicknames] of Object.entries(NICKNAME_MAP)) {
        if (
          (token1 === formal && nicknames.includes(token2)) ||
          (token2 === formal && nicknames.includes(token1)) ||
          (nicknames.includes(token1) && nicknames.includes(token2))
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Generate name variants for fuzzy matching
 */
export function generateNameVariants(name: string): string[] {
  const variants: string[] = [normalizeName(name)];
  const parsed = getNormalizedName(name);

  // Add first initial + last name
  if (parsed.tokens.length >= 2) {
    variants.push(`${parsed.firstInitial} ${parsed.lastName}`);
  }

  // Add last name only
  if (parsed.lastName) {
    variants.push(parsed.lastName);
  }

  // Add full name without middle names/initials
  if (parsed.tokens.length > 2) {
    variants.push(`${parsed.tokens[0]} ${parsed.lastName}`);
  }

  return [...new Set(variants)];
}

/**
 * Score name match quality
 */
export function scoreNameMatch(
  name1: string,
  name2: string
): {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
} {
  const n1 = getNormalizedName(name1);
  const n2 = getNormalizedName(name2);

  // Exact match
  if (n1.normalized === n2.normalized) {
    return {
      score: 1.0,
      confidence: 'high',
      reason: 'Exact normalized match',
    };
  }

  // Last name + first initial match
  if (
    n1.lastName === n2.lastName &&
    n1.firstInitial === n2.firstInitial &&
    n1.lastName.length > 2
  ) {
    return {
      score: 0.95,
      confidence: 'high',
      reason: 'Last name + first initial match',
    };
  }

  // Nickname match
  if (n1.lastName === n2.lastName && couldBeNickname(name1, name2)) {
    return {
      score: 0.93,
      confidence: 'high',
      reason: 'Last name + likely nickname',
    };
  }

  // Fuzzy similarity
  const similarity = nameSimilarity(name1, name2);

  if (similarity >= 0.92) {
    return {
      score: similarity,
      confidence: 'high',
      reason: `High fuzzy similarity (${(similarity * 100).toFixed(1)}%)`,
    };
  }

  if (similarity >= 0.85) {
    return {
      score: similarity,
      confidence: 'medium',
      reason: `Medium fuzzy similarity (${(similarity * 100).toFixed(1)}%)`,
    };
  }

  if (similarity >= 0.75) {
    return {
      score: similarity,
      confidence: 'low',
      reason: `Low fuzzy similarity (${(similarity * 100).toFixed(1)}%)`,
    };
  }

  return {
    score: similarity,
    confidence: 'low',
    reason: 'Names do not match',
  };
}

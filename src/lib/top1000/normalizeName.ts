/**
 * Name Normalization for Player Matching
 *
 * Converts player names to a canonical format for matching across data sources.
 * Handles common variations, suffixes, punctuation, and spacing differences.
 */

/**
 * Normalize a player name for matching
 * - Lowercase
 * - Remove punctuation (except spaces)
 * - Collapse multiple spaces to single space
 * - Remove common suffixes (Jr, Sr, II, III, IV, V)
 * - Trim whitespace
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  let normalized = name.toLowerCase();

  // Remove common suffixes
  const suffixes = [
    ' jr.', ' jr', ' sr.', ' sr',
    ' ii', ' iii', ' iv', ' v',
    ' 2nd', ' 3rd', ' 4th', ' 5th'
  ];

  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
    }
  }

  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Trim
  normalized = normalized.trim();

  return normalized;
}

/**
 * Generate name variants for alias generation
 * Returns array of possible name variations
 */
export function generateNameVariants(fullName: string): string[] {
  const variants: string[] = [];
  const normalized = normalizeName(fullName);

  // Add the normalized full name
  variants.push(normalized);

  // Split into parts
  const parts = normalized.split(' ');

  if (parts.length >= 2) {
    // First Last
    variants.push(`${parts[0]} ${parts[parts.length - 1]}`);

    // First Middle Last -> First Last
    if (parts.length > 2) {
      variants.push(`${parts[0]} ${parts[parts.length - 1]}`);

      // Also try First MiddleInitial Last
      const middleInitial = parts.slice(1, -1).map(p => p[0]).join('');
      if (middleInitial) {
        variants.push(`${parts[0]} ${middleInitial} ${parts[parts.length - 1]}`);
      }
    }

    // Handle hyphenated last names
    const lastName = parts[parts.length - 1];
    if (lastName.includes('-')) {
      // Try without hyphen
      const withoutHyphen = lastName.replace(/-/g, ' ');
      variants.push(`${parts[0]} ${withoutHyphen}`);

      // Try just last part of hyphenated name
      const lastPart = lastName.split('-').pop();
      if (lastPart) {
        variants.push(`${parts[0]} ${lastPart}`);
      }
    }
  }

  // Remove duplicates and empty strings
  return Array.from(new Set(variants.filter(v => v.length > 0)));
}

/**
 * Calculate similarity score between two normalized names
 * Returns 0-1, where 1 is exact match
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match
  if (norm1 === norm2) return 1.0;

  // Token overlap
  const tokens1 = new Set(norm1.split(' '));
  const tokens2 = new Set(norm2.split(' '));

  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 0;

  const tokenOverlap = intersection.size / union.size;

  // Levenshtein distance for similar but not exact matches
  const levDistance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  const levSimilarity = maxLen > 0 ? 1 - (levDistance / maxLen) : 0;

  // Weighted combination
  return tokenOverlap * 0.6 + levSimilarity * 0.4;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Extract first name from full name
 */
export function extractFirstName(fullName: string): string {
  const normalized = normalizeName(fullName);
  return normalized.split(' ')[0] || '';
}

/**
 * Extract last name from full name
 */
export function extractLastName(fullName: string): string {
  const normalized = normalizeName(fullName);
  const parts = normalized.split(' ');
  return parts[parts.length - 1] || '';
}

/**
 * Check if a name contains another name (useful for nickname matching)
 */
export function nameContains(fullName: string, searchTerm: string): boolean {
  const normalized = normalizeName(fullName);
  const search = normalizeName(searchTerm);
  return normalized.includes(search);
}

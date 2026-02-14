/**
 * Normalize player names for consistent matching across data sources
 *
 * Rules:
 * - Convert to lowercase
 * - Remove punctuation (periods, commas, apostrophes, hyphens)
 * - Collapse multiple spaces to single space
 * - Remove common suffixes (Jr, Sr, II, III, IV, V)
 * - Convert dot variants (D.J. → dj, A.J. → aj)
 * - Keep only letters, numbers, and spaces
 * - Trim whitespace
 */

const SUFFIXES = ['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'junior', 'senior'];

const PUNCTUATION_REGEX = /[.,\/#!$%\^&\*;:{}=\-_`~()]/g;

const MULTIPLE_SPACES_REGEX = /\s+/g;

const NON_ALPHANUMERIC_SPACE_REGEX = /[^a-z0-9\s]/g;

export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  let normalized = name.trim();

  normalized = normalized.toLowerCase();

  normalized = normalized.replace(/'/g, '');

  normalized = normalized.replace(/\./g, ' ');

  normalized = normalized.replace(PUNCTUATION_REGEX, ' ');

  normalized = normalized.replace(MULTIPLE_SPACES_REGEX, ' ').trim();

  const words = normalized.split(' ');
  const filteredWords = words.filter(word => {
    return word.length > 0 && !SUFFIXES.includes(word);
  });
  normalized = filteredWords.join(' ');

  normalized = normalized.replace(NON_ALPHANUMERIC_SPACE_REGEX, '');

  normalized = normalized.replace(MULTIPLE_SPACES_REGEX, ' ').trim();

  normalized = normalized.replace(/\s+/g, '');

  return normalized;
}

export function generateAliases(fullName: string, firstName?: string, lastName?: string): string[] {
  const aliases: string[] = [];

  if (fullName) {
    aliases.push(fullName);
  }

  if (firstName && lastName) {
    aliases.push(`${firstName} ${lastName}`);
    aliases.push(`${lastName}, ${firstName}`);
    aliases.push(`${firstName}${lastName}`);

    if (firstName.length > 0 && lastName.length > 0) {
      aliases.push(`${firstName.charAt(0)} ${lastName}`);
      aliases.push(`${firstName.charAt(0)}. ${lastName}`);
      aliases.push(`${firstName} ${lastName.charAt(0)}`);
      aliases.push(`${firstName} ${lastName.charAt(0)}.`);
    }
  }

  const nameParts = fullName?.split(' ') || [];
  if (nameParts.length === 2) {
    const [first, last] = nameParts;
    aliases.push(`${first}${last}`);
    aliases.push(`${first.charAt(0)}${last}`);
    aliases.push(`${first} ${last.charAt(0)}`);
  }

  return [...new Set(aliases.filter(Boolean))];
}

export function tokenize(name: string): string[] {
  const normalized = normalizeName(name);

  const withSpaces = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withSpaces.split(' ').filter(Boolean);
}

export function calculateTokenOverlap(name1: string, name2: string): number {
  const tokens1 = new Set(tokenize(name1));
  const tokens2 = new Set(tokenize(name2));

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

export function fuzzyMatch(query: string, candidate: string, threshold: number = 0.6): boolean {
  const overlap = calculateTokenOverlap(query, candidate);
  return overlap >= threshold;
}

export function scoreMatch(
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

export function extractFirstLastName(fullName: string): { firstName: string; lastName: string } | null {
  const cleaned = fullName
    .trim()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?$/i, '')
    .trim();

  const parts = cleaned.split(/\s+/);

  if (parts.length < 2) {
    return null;
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');

  return { firstName, lastName };
}

export function isLikelyMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (norm1 === norm2) {
    return true;
  }

  const tokens1 = tokenize(name1);
  const tokens2 = tokenize(name2);

  if (tokens1.length < 2 || tokens2.length < 2) {
    return false;
  }

  const lastToken1 = tokens1[tokens1.length - 1];
  const lastToken2 = tokens2[tokens2.length - 1];

  if (lastToken1 === lastToken2) {
    const firstInitial1 = tokens1[0].charAt(0);
    const firstInitial2 = tokens2[0].charAt(0);

    if (firstInitial1 === firstInitial2) {
      return true;
    }
  }

  return calculateTokenOverlap(name1, name2) >= 0.7;
}

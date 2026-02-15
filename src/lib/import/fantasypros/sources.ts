export interface FantasyProsSource {
  id: string;
  label: string;
  url: string;
  category: 'dynasty' | 'redraft' | 'adp' | 'idp';
  flavor?: 'ppr' | 'half' | 'standard';
  priority: number;
}

export const FANTASYPROS_SOURCES: FantasyProsSource[] = [
  {
    id: 'dynasty_superflex',
    label: 'Dynasty Superflex',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-superflex.php',
    category: 'dynasty',
    priority: 1,
  },
  {
    id: 'dynasty_overall',
    label: 'Dynasty Overall (1QB)',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-overall.php',
    category: 'dynasty',
    priority: 2,
  },
  {
    id: 'idp_overall',
    label: 'IDP Overall',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-idp.php',
    category: 'idp',
    priority: 1,
  },
  {
    id: 'idp_dl',
    label: 'IDP DL',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-dl.php',
    category: 'idp',
    priority: 2,
  },
  {
    id: 'idp_lb',
    label: 'IDP LB',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-lb.php',
    category: 'idp',
    priority: 3,
  },
  {
    id: 'idp_db',
    label: 'IDP DB',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-db.php',
    category: 'idp',
    priority: 4,
  },
  {
    id: 'redraft_ppr',
    label: 'Redraft PPR',
    url: 'https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php',
    category: 'redraft',
    flavor: 'ppr',
    priority: 1,
  },
  {
    id: 'redraft_half_ppr',
    label: 'Redraft Half-PPR',
    url: 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php',
    category: 'redraft',
    flavor: 'half',
    priority: 1,
  },
  {
    id: 'adp_ppr',
    label: 'ADP PPR',
    url: 'https://www.fantasypros.com/nfl/adp/ppr-overall.php',
    category: 'adp',
    flavor: 'ppr',
    priority: 1,
  },
  {
    id: 'adp_half_ppr',
    label: 'ADP Half-PPR',
    url: 'https://www.fantasypros.com/nfl/adp/half-point-ppr-overall.php',
    category: 'adp',
    flavor: 'half',
    priority: 1,
  },
];

export function getSourceById(id: string): FantasyProsSource | undefined {
  return FANTASYPROS_SOURCES.find((s) => s.id === id);
}

export function getSourcesByCategory(
  category: 'dynasty' | 'redraft' | 'adp' | 'idp'
): FantasyProsSource[] {
  return FANTASYPROS_SOURCES.filter((s) => s.category === category).sort(
    (a, b) => a.priority - b.priority
  );
}

export function getDynastySources(): FantasyProsSource[] {
  return getSourcesByCategory('dynasty');
}

export function getIdpSources(): FantasyProsSource[] {
  return getSourcesByCategory('idp');
}

export function getRedraftSources(): FantasyProsSource[] {
  return getSourcesByCategory('redraft');
}

export function getAdpSources(): FantasyProsSource[] {
  return getSourcesByCategory('adp');
}

export function getSourcesForFlavor(
  flavor: 'ppr' | 'half'
): FantasyProsSource[] {
  return FANTASYPROS_SOURCES.filter((s) => s.flavor === flavor);
}

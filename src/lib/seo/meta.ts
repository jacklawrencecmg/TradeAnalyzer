export interface MetaTagsConfig {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

export function generateMetaTags(config: MetaTagsConfig): void {
  document.title = config.title;

  setMetaTag('description', config.description);

  if (config.canonical) {
    setLinkTag('canonical', config.canonical);
  }

  setMetaTag('og:title', config.ogTitle || config.title, 'property');
  setMetaTag('og:description', config.ogDescription || config.description, 'property');
  setMetaTag('og:type', config.ogType || 'website', 'property');

  if (config.ogImage) {
    setMetaTag('og:image', config.ogImage, 'property');
  }

  setMetaTag('twitter:card', 'summary_large_image');
  setMetaTag('twitter:title', config.ogTitle || config.title);
  setMetaTag('twitter:description', config.ogDescription || config.description);

  if (config.keywords && config.keywords.length > 0) {
    setMetaTag('keywords', config.keywords.join(', '));
  }

  if (config.author) {
    setMetaTag('author', config.author);
  }

  if (config.publishedTime) {
    setMetaTag('article:published_time', config.publishedTime, 'property');
  }

  if (config.modifiedTime) {
    setMetaTag('article:modified_time', config.modifiedTime, 'property');
  }
}

function setMetaTag(name: string, content: string, type: 'name' | 'property' = 'name'): void {
  let element = document.querySelector(`meta[${type}="${name}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(type, name);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function setLinkTag(rel: string, href: string): void {
  let element = document.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

export function generatePlayerMetaTags(player: {
  full_name: string;
  position: string;
  team?: string;
  fdp_value?: number;
  dynasty_rank?: number;
  value_epoch?: string;
}) {
  const slug = generatePlayerSlug(player.full_name);
  const canonical = `https://www.fantasydraftpros.com/dynasty-value/${slug}`;

  const title = `${player.full_name} Dynasty Value (2026) | Fantasy Trade Calculator`;
  const description = `See ${player.full_name}'s dynasty value (${player.fdp_value || 'N/A'}), ${player.position} ranking ${player.dynasty_rank ? `#${player.dynasty_rank}` : ''}, trade advice, and comparison vs similar players. Updated daily with expert analysis.`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogType: 'article',
    keywords: [
      `${player.full_name} dynasty value`,
      `${player.full_name} trade value`,
      `${player.full_name} fantasy football`,
      'dynasty rankings',
      `${player.position} rankings`,
      'fantasy trade calculator',
      player.team || ''
    ].filter(Boolean),
    author: 'Fantasy Draft Pros',
    modifiedTime: player.value_epoch || new Date().toISOString()
  };
}

export function generateRankingsMetaTags(type: 'dynasty' | 'superflex' | 'rookie' | 'idp') {
  const titles = {
    dynasty: 'Dynasty Rankings 2026 | Top 1000 Player Values',
    superflex: 'Dynasty Superflex Rankings 2026 | Player Values',
    rookie: 'Dynasty Rookie Rankings 2026 | Draft Pick Values',
    idp: 'IDP Dynasty Rankings 2026 | Defensive Player Values'
  };

  const descriptions = {
    dynasty: 'Complete dynasty fantasy football rankings for 2026. Top 1000 players with values, tiers, and trade analysis. Updated daily.',
    superflex: 'Superflex dynasty rankings with QB premium values. Complete player valuations for 12-team superflex leagues. Updated daily.',
    rookie: 'Dynasty rookie draft rankings and pick values for 2026. Compare rookie picks by round and draft slot. Updated after every game.',
    idp: 'IDP dynasty rankings for defensive players. Complete linebacker, defensive line, and defensive back values. Updated weekly.'
  };

  const type_slug = type === 'dynasty' ? 'dynasty-rankings' : `dynasty-${type}-rankings`;

  return {
    title: titles[type],
    description: descriptions[type],
    canonical: `https://www.fantasydraftpros.com/${type_slug}`,
    ogType: 'website',
    keywords: [
      `${type} rankings`,
      'fantasy football rankings',
      'dynasty player values',
      'trade calculator',
      'player values 2026'
    ],
    author: 'Fantasy Draft Pros',
    modifiedTime: new Date().toISOString()
  };
}

export function generateComparisonMetaTags(player1: string, player2: string) {
  const slug1 = generatePlayerSlug(player1);
  const slug2 = generatePlayerSlug(player2);

  const title = `${player1} vs ${player2} Dynasty Comparison (2026)`;
  const description = `Compare ${player1} and ${player2} dynasty values, rankings, and trade analysis. See which player has more value in dynasty fantasy football.`;

  return {
    title,
    description,
    canonical: `https://www.fantasydraftpros.com/compare/${slug1}-vs-${slug2}-dynasty`,
    ogType: 'article',
    keywords: [
      `${player1} vs ${player2}`,
      'dynasty comparison',
      'player comparison',
      'trade value comparison',
      'dynasty rankings'
    ],
    author: 'Fantasy Draft Pros'
  };
}

export function generatePlayerSlug(playerName: string): string {
  return playerName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function parsePlayerSlug(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

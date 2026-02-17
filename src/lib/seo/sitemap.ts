import { supabase } from '../supabase';
import { generatePlayerSlug } from './meta';

export interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export async function generateSitemap(): Promise<SitemapUrl[]> {
  const baseUrl = 'https://www.fantasydraftpros.com';
  const urls: SitemapUrl[] = [];

  urls.push({
    loc: baseUrl,
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 1.0
  });

  urls.push({
    loc: `${baseUrl}/dynasty-rankings`,
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 0.9
  });

  urls.push({
    loc: `${baseUrl}/dynasty-superflex-rankings`,
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 0.8
  });

  urls.push({
    loc: `${baseUrl}/dynasty-rookie-rankings`,
    lastmod: new Date().toISOString(),
    changefreq: 'daily',
    priority: 0.8
  });

  urls.push({
    loc: `${baseUrl}/dynasty-idp-rankings`,
    lastmod: new Date().toISOString(),
    changefreq: 'weekly',
    priority: 0.7
  });

  urls.push({
    loc: `${baseUrl}/trade-calculator`,
    lastmod: new Date().toISOString(),
    changefreq: 'weekly',
    priority: 0.8
  });

  try {
    const { data: players, error } = await supabase
      .rpc('get_latest_player_values', {})
      .order('base_value', { ascending: false })
      .limit(1000);

    if (error) throw error;

    if (players) {
      players.forEach((player: any) => {
        const slug = generatePlayerSlug(player.full_name);
        urls.push({
          loc: `${baseUrl}/dynasty-value/${slug}`,
          lastmod: player.value_epoch || new Date().toISOString(),
          changefreq: 'daily',
          priority: 0.7
        });
      });
    }
  } catch (err) {
    console.error('Error generating player URLs for sitemap:', err);
  }

  return urls;
}

export function generateSitemapXML(urls: SitemapUrl[]): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return xml;
}

export async function saveSitemap(): Promise<void> {
  try {
    const urls = await generateSitemap();
    const xml = generateSitemapXML(urls);

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    a.click();
    URL.revokeObjectURL(url);

    console.log(`Sitemap generated with ${urls.length} URLs`);
  } catch (err) {
    console.error('Error saving sitemap:', err);
  }
}

export function getRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: https://www.fantasydraftpros.com/sitemap.xml

# Disallow private league pages
Disallow: /league/*
`;
}

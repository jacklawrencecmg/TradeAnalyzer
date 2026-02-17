import { useState } from 'react';
import { Download, RefreshCw, Search, ExternalLink } from 'lucide-react';
import { saveSitemap, getRobotsTxt } from '../lib/seo/sitemap';
import { supabase } from '../lib/supabase';
import { generatePlayerSlug } from '../lib/seo/meta';

export function SEOAdmin() {
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  async function handleGenerateSitemap() {
    setGenerating(true);
    try {
      await saveSitemap();
      alert('Sitemap generated successfully!');
    } catch (err) {
      console.error('Error generating sitemap:', err);
      alert('Failed to generate sitemap');
    } finally {
      setGenerating(false);
    }
  }

  async function loadStats() {
    try {
      const { data: players } = await supabase
        .rpc('get_latest_player_values', {})
        .limit(1000);

      const { data: leagues } = await supabase
        .from('leagues')
        .select('league_id')
        .limit(1);

      setStats({
        totalPlayers: players?.length || 0,
        indexablePages: (players?.length || 0) + 10,
        lastUpdated: players?.[0]?.value_epoch || new Date().toISOString()
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  async function handleSearch() {
    if (!searchTerm.trim()) return;

    try {
      const { data } = await supabase
        .rpc('get_latest_player_values', {})
        .ilike('full_name', `%${searchTerm}%`)
        .limit(20);

      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching:', err);
    }
  }

  function downloadRobotsTxt() {
    const txt = getRobotsTxt();
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'robots.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-fdp-text-1 mb-2">SEO Management</h1>
          <p className="text-fdp-text-3">Manage sitemaps, robots.txt, and SEO settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
            <div className="text-sm text-fdp-text-3 mb-2">Total Players</div>
            <div className="text-3xl font-bold text-fdp-accent-1">
              {stats?.totalPlayers || '-'}
            </div>
          </div>

          <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
            <div className="text-sm text-fdp-text-3 mb-2">Indexable Pages</div>
            <div className="text-3xl font-bold text-fdp-accent-1">
              {stats?.indexablePages || '-'}
            </div>
          </div>

          <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
            <div className="text-sm text-fdp-text-3 mb-2">Last Updated</div>
            <div className="text-lg font-bold text-fdp-text-1">
              {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : '-'}
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 mb-6">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Sitemap Generation</h2>
          <p className="text-fdp-text-3 mb-6">
            Generate an XML sitemap with all player pages, rankings, and comparison pages.
          </p>

          <div className="flex gap-4">
            <button
              onClick={handleGenerateSitemap}
              disabled={generating}
              className="flex items-center gap-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              {generating ? 'Generating...' : 'Generate Sitemap'}
            </button>

            <button
              onClick={downloadRobotsTxt}
              className="flex items-center gap-2 bg-fdp-surface-2 text-fdp-text-1 font-semibold py-3 px-6 rounded-lg border border-fdp-border-1 hover:border-fdp-accent-1 transition-all"
            >
              <Download className="w-5 h-5" />
              Download robots.txt
            </button>

            <button
              onClick={loadStats}
              className="flex items-center gap-2 bg-fdp-surface-2 text-fdp-text-1 font-semibold py-3 px-6 rounded-lg border border-fdp-border-1 hover:border-fdp-accent-1 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh Stats
            </button>
          </div>
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1 mb-6">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Test Player URLs</h2>
          <p className="text-fdp-text-3 mb-4">
            Search for a player to generate their SEO-friendly URL.
          </p>

          <div className="flex gap-4 mb-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter player name..."
              className="flex-1 px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
            />
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-2 px-6 rounded-lg hover:shadow-lg transition-all"
            >
              <Search className="w-5 h-5" />
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(player => {
                const slug = generatePlayerSlug(player.full_name);
                const url = `/dynasty-value/${slug}`;

                return (
                  <div
                    key={player.player_id}
                    className="bg-fdp-surface-2 rounded-lg p-4 border border-fdp-border-1"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-fdp-text-1">{player.full_name}</div>
                        <div className="text-sm text-fdp-text-3">
                          {player.position} • {player.team || 'FA'}
                        </div>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-fdp-accent-1 hover:text-fdp-accent-2 transition-colors"
                      >
                        <span className="text-sm font-mono">{url}</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">SEO URLs Structure</h2>
          <div className="space-y-3 text-fdp-text-2">
            <div>
              <div className="font-semibold text-fdp-text-1 mb-1">Player Pages</div>
              <code className="text-sm bg-fdp-surface-2 px-2 py-1 rounded">/dynasty-value/[player-slug]</code>
              <div className="text-xs text-fdp-text-3 mt-1">Example: /dynasty-value/jaxon-smith-njigba</div>
            </div>

            <div>
              <div className="font-semibold text-fdp-text-1 mb-1">Rankings Pages</div>
              <code className="text-sm bg-fdp-surface-2 px-2 py-1 rounded">/dynasty-rankings</code>
              <div className="text-xs text-fdp-text-3 mt-1">Also: /dynasty-superflex-rankings, /dynasty-rookie-rankings</div>
            </div>

            <div>
              <div className="font-semibold text-fdp-text-1 mb-1">Comparison Pages</div>
              <code className="text-sm bg-fdp-surface-2 px-2 py-1 rounded">/compare/[player1]-vs-[player2]-dynasty</code>
              <div className="text-xs text-fdp-text-3 mt-1">Example: /compare/ja-marr-chase-vs-ceedee-lamb-dynasty</div>
            </div>

            <div>
              <div className="font-semibold text-fdp-text-1 mb-1">Trade Calculator</div>
              <code className="text-sm bg-fdp-surface-2 px-2 py-1 rounded">/trade-calculator</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

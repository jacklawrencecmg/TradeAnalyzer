import { useState } from 'react';
import { Code, Copy, Check, ExternalLink, Share2 } from 'lucide-react';

interface EmbedInstructionsProps {
  playerName: string;
  playerId: string;
}

export function EmbedInstructions({ playerName, playerId }: EmbedInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'widget' | 'api'>('widget');

  const widgetCode = `<script src="https://www.fantasydraftpros.com/embed/player.js" data-player="${playerName}"></script>`;

  const apiExample = `https://www.fantasydraftpros.com/functions/v1/discord-player-value?name=${encodeURIComponent(playerName.toLowerCase().replace(/\s+/g, '-'))}`;

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  return (
    <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-lg flex items-center justify-center">
          <Share2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-fdp-text-1">Embed & Share</h3>
          <p className="text-sm text-fdp-text-3">
            Add live dynasty values to your site or Discord
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setActiveTab('widget')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'widget'
              ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white'
              : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
          }`}
        >
          Website Widget
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            activeTab === 'api'
              ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-white'
              : 'bg-fdp-surface-2 text-fdp-text-3 hover:bg-fdp-border-1'
          }`}
        >
          Discord/API
        </button>
      </div>

      {activeTab === 'widget' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-fdp-text-2">
                Embed Code
              </label>
              <button
                onClick={() => copyToClipboard(widgetCode)}
                className="flex items-center gap-1 px-3 py-1 bg-fdp-surface-2 hover:bg-fdp-border-1 rounded-lg text-sm font-semibold text-fdp-text-2 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-fdp-bg-0 rounded-lg p-4 border border-fdp-border-1 font-mono text-sm text-fdp-text-2 overflow-x-auto">
              {widgetCode}
            </div>
          </div>

          <div className="bg-fdp-surface-2 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Code className="w-5 h-5 text-fdp-accent-1 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-fdp-text-1 mb-1">
                  How it works
                </div>
                <ul className="text-xs text-fdp-text-3 space-y-1">
                  <li>• Paste the code into your website's HTML</li>
                  <li>• Widget displays live dynasty value, tier, rank, and trend</li>
                  <li>• Updates automatically when values change</li>
                  <li>• Includes attribution link to FDP</li>
                  <li>• Fully responsive and styled</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-fdp-accent-1/30 rounded-lg p-4">
            <div className="text-sm font-semibold text-fdp-accent-1 mb-2">
              Benefits of Embedding
            </div>
            <ul className="text-xs text-fdp-text-2 space-y-1">
              <li>• Always shows current values (no manual updates)</li>
              <li>• Builds authority through quality data sources</li>
              <li>• Free to use with attribution</li>
              <li>• Creates natural backlinks to your content</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-fdp-text-2">
                Discord Bot Endpoint
              </label>
              <button
                onClick={() => copyToClipboard(apiExample)}
                className="flex items-center gap-1 px-3 py-1 bg-fdp-surface-2 hover:bg-fdp-border-1 rounded-lg text-sm font-semibold text-fdp-text-2 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-fdp-bg-0 rounded-lg p-4 border border-fdp-border-1 font-mono text-xs text-fdp-text-2 overflow-x-auto break-all">
              {apiExample}
            </div>
          </div>

          <div className="bg-fdp-surface-2 rounded-lg p-4 space-y-3">
            <div className="text-sm font-semibold text-fdp-text-1 mb-2">
              Response Format
            </div>
            <div className="bg-fdp-bg-0 rounded-lg p-3 border border-fdp-border-1 font-mono text-xs text-fdp-text-2">
              <div className="text-green-400">**{playerName}** — Dynasty WR3 (Tier 1)</div>
              <div className="text-blue-400">Value: **3500** 📈</div>
              <div className="text-gray-400">Rank: #15 Overall | #8 WR</div>
              <div className="text-gray-400">Updated today</div>
              <div className="text-blue-400 underline">
                https://www.fantasydraftpros.com/...
              </div>
            </div>
          </div>

          <div className="bg-fdp-surface-2 rounded-lg p-4">
            <div className="text-sm font-semibold text-fdp-text-1 mb-2">
              Usage Examples
            </div>
            <div className="text-xs text-fdp-text-3 space-y-2">
              <div>
                <span className="font-semibold text-fdp-text-2">By name:</span>
                <div className="font-mono bg-fdp-bg-0 px-2 py-1 rounded mt-1 text-fdp-accent-1">
                  ?name=breece-hall
                </div>
              </div>
              <div>
                <span className="font-semibold text-fdp-text-2">JSON format:</span>
                <div className="font-mono bg-fdp-bg-0 px-2 py-1 rounded mt-1 text-fdp-accent-1">
                  ?name=breece-hall&format=json
                </div>
              </div>
            </div>
          </div>

          <a
            href="/api-docs"
            className="flex items-center gap-2 text-sm font-semibold text-fdp-accent-1 hover:text-fdp-accent-2 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Full API Documentation
          </a>
        </div>
      )}
    </div>
  );
}

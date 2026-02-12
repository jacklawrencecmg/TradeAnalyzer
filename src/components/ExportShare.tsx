import React, { useState } from 'react';
import { Share2, Download, Image as ImageIcon } from 'lucide-react';

interface ExportShareProps {
  leagueId: string;
  rosterId: string;
}

export default function ExportShare({ leagueId, rosterId }: ExportShareProps) {
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('power_rankings');

  const templates = [
    { id: 'power_rankings', name: 'Power Rankings', description: 'Share your league power rankings' },
    { id: 'trade_analysis', name: 'Trade Analysis', description: 'Export trade breakdown with values' },
    { id: 'roster_summary', name: 'Roster Summary', description: 'Your roster with player values' },
    { id: 'weekly_recap', name: 'Weekly Recap', description: 'Weekly matchup results and highlights' },
    { id: 'playoff_bracket', name: 'Playoff Bracket', description: 'Championship tournament bracket' },
    { id: 'draft_results', name: 'Draft Results', description: 'Draft picks and grades' }
  ];

  const generateGraphic = async () => {
    setGenerating(true);

    await new Promise(resolve => setTimeout(resolve, 2000));

    alert(`${templates.find(t => t.id === selectedTemplate)?.name} graphic generated! (This is a demo)`);
    setGenerating(false);
  };

  const exportToCSV = () => {
    alert('CSV export started! (This is a demo)');
  };

  const shareToSocial = (platform: string) => {
    alert(`Share to ${platform} clicked! (This is a demo)`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Share2 className="w-8 h-8 text-blue-400" />
          <h1 className="text-3xl font-bold">Export & Share</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-6">Generate Graphics</h2>
            <div className="space-y-4 mb-6">
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`bg-gray-800/50 backdrop-blur-sm rounded-lg border p-4 cursor-pointer transition ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ImageIcon className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg">{template.name}</h3>
                      <p className="text-sm text-gray-400">{template.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={generateGraphic}
              disabled={generating}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  Generate Graphic
                </>
              )}
            </button>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-6">Export Data</h2>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6 mb-6">
              <h3 className="font-bold text-lg mb-4">Download Options</h3>
              <div className="space-y-3">
                <button
                  onClick={exportToCSV}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export to CSV
                </button>
                <button
                  onClick={() => alert('PDF export started!')}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export to PDF
                </button>
                <button
                  onClick={() => alert('JSON export started!')}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Export to JSON
                </button>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-6">
              <h3 className="font-bold text-lg mb-4">Share to Social Media</h3>
              <div className="space-y-3">
                <button
                  onClick={() => shareToSocial('Twitter/X')}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Share to Twitter/X
                </button>
                <button
                  onClick={() => shareToSocial('Facebook')}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Share to Facebook
                </button>
                <button
                  onClick={() => shareToSocial('Reddit')}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Share to Reddit
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied to clipboard!');
                  }}
                  className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-2">Pro Tip</h3>
          <p className="text-gray-300">
            Generated graphics are optimized for social media sharing. They include your league branding
            and are sized perfectly for Twitter, Facebook, and Instagram posts.
          </p>
        </div>
      </div>
    </div>
  );
}

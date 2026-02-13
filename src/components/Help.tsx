import { useState } from 'react';
import {
  BookOpen,
  X,
  TrendingUp,
  Users,
  Trophy,
  Activity,
  Shield,
  Clipboard,
  Search,
  Calendar,
  DollarSign,
  ArrowLeftRight,
  ShoppingCart,
  MessageCircle,
  Bell,
  Newspaper,
  Share2,
  Target,
  BarChart3,
  Zap,
} from 'lucide-react';

interface HelpProps {
  onClose: () => void;
}

export function Help({ onClose }: HelpProps) {
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', label: 'Getting Started', icon: Target },
    { id: 'platforms', label: 'Platform Setup', icon: Shield },
    { id: 'trade-analyzer', label: 'Trade Analyzer', icon: ArrowLeftRight },
    { id: 'power-rankings', label: 'Power Rankings', icon: TrendingUp },
    { id: 'playoff-simulator', label: 'Playoff Simulator', icon: Trophy },
    { id: 'roster-tools', label: 'Roster Tools', icon: Users },
    { id: 'draft-keeper', label: 'Draft & Keeper', icon: Clipboard },
    { id: 'advanced', label: 'Advanced Features', icon: Zap },
    { id: 'tips', label: 'Tips & Best Practices', icon: BarChart3 },
  ];

  const content: Record<string, JSX.Element> = {
    'getting-started': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Getting Started with Fantasy Draft Pros</h2>
          <p className="text-fdp-text-2 mb-4">
            Welcome to Fantasy Draft Pros! This guide will help you get up and running quickly.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Quick Start Guide</h3>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <div>
                <h4 className="font-semibold text-fdp-text-1">Create Your Account</h4>
                <p className="text-fdp-text-2 text-sm mt-1">
                  Click "Sign In" and enter your email. No credit card required - completely free!
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <div>
                <h4 className="font-semibold text-fdp-text-1">Add Your Leagues</h4>
                <p className="text-fdp-text-2 text-sm mt-1">
                  Click "Add League" and select your platform (Sleeper or ESPN). Enter your League ID and you're done!
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <div>
                <h4 className="font-semibold text-fdp-text-1">Explore Features</h4>
                <p className="text-fdp-text-2 text-sm mt-1">
                  Use the top navigation to access Trade Analyzer, Power Rankings, Playoff Odds, and more!
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Navigation Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-2">Main Tools</h4>
              <ul className="space-y-2 text-fdp-text-2">
                <li className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-fdp-accent-1" />
                  Trade Analyzer - Evaluate trades
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-fdp-accent-1" />
                  Power Rankings - Team strength
                </li>
                <li className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-fdp-accent-1" />
                  Playoff Odds - Championship probabilities
                </li>
                <li className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-fdp-accent-1" />
                  Trade History - Past deals
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-2">Advanced Features</h4>
              <ul className="space-y-2 text-fdp-text-2">
                <li className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-fdp-accent-1" />
                  Player Values - Market pricing
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-fdp-accent-1" />
                  Lineup Optimizer - Best lineups
                </li>
                <li className="flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-fdp-accent-1" />
                  Draft Kit - Draft assistance
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-fdp-accent-1" />
                  Weekly Recap - League summaries
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),

    'platforms': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Multi-Platform Setup</h2>
          <p className="text-fdp-text-2 mb-4">
            Fantasy Draft Pros supports multiple fantasy platforms. Here's how to connect each one.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
            🛌 Sleeper (Easiest)
          </h3>
          <ol className="space-y-3 text-fdp-text-2">
            <li>1. Open your league on Sleeper.com or in the Sleeper app</li>
            <li>2. Look at the URL: <code className="bg-fdp-surface-2 px-2 py-1 rounded text-xs">sleeper.com/leagues/123456789</code></li>
            <li>3. Copy the numbers after "/leagues/" (that's your League ID)</li>
            <li>4. In Fantasy Draft Pros, click "Add League"</li>
            <li>5. Select Sleeper and paste your League ID</li>
            <li>6. Done! No authentication needed</li>
          </ol>
          <div className="mt-4 p-3 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-lg">
            <p className="text-sm text-fdp-text-2">
              ✓ Works with all Sleeper leagues (public and private)
            </p>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
            🏈 ESPN Fantasy (Authentication Required)
          </h3>
          <p className="text-fdp-text-2 mb-4">
            ESPN requires cookies for private leagues. Here's how to get them:
          </p>
          <ol className="space-y-3 text-fdp-text-2">
            <li>1. Open ESPN Fantasy Football and log in</li>
            <li>2. Press <kbd className="bg-fdp-surface-2 px-2 py-1 rounded text-xs">F12</kbd> to open Developer Tools</li>
            <li>3. Go to "Application" (Chrome) or "Storage" (Firefox) tab</li>
            <li>4. Click "Cookies" in the left sidebar</li>
            <li>5. Find ESPN's domain and locate these two cookies:
              <ul className="ml-6 mt-2 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <div>
                    <code className="bg-fdp-surface-2 px-2 py-1 rounded text-xs">espn_s2</code> - Long alphanumeric string
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <div>
                    <code className="bg-fdp-surface-2 px-2 py-1 rounded text-xs">SWID</code> - Format: {'{'}XXXX-XXXX-XXXX{'}'}
                  </div>
                </li>
              </ul>
            </li>
            <li>6. Copy both values (double-click to select, then Ctrl/Cmd+C)</li>
            <li>7. In Fantasy Draft Pros, click "Add League"</li>
            <li>8. Select ESPN platform</li>
            <li>9. Enter your League ID and paste both cookie values</li>
            <li>10. Click "Add League"</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-lg">
            <p className="text-sm text-fdp-text-2 font-semibold mb-1">⚠️ Important Notes:</p>
            <ul className="text-sm text-fdp-text-2 space-y-1">
              <li>• ESPN cookies expire every few weeks/months</li>
              <li>• If your league stops loading, refresh your cookies</li>
              <li>• Save cookies in a secure note for easy updates</li>
              <li>• Never share your cookies with anyone</li>
            </ul>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4 flex items-center gap-2">
            🟣 Yahoo Fantasy (Coming Soon)
          </h3>
          <p className="text-fdp-text-2">
            Yahoo integration with OAuth 2.0 authentication is currently in development. Check back soon for full Yahoo support!
          </p>
        </div>
      </div>
    ),

    'trade-analyzer': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Trade Analyzer Guide</h2>
          <p className="text-fdp-text-2 mb-4">
            Master the art of trade evaluation with our comprehensive Trade Analyzer.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">How to Analyze a Trade</h3>
          <ol className="space-y-4 text-fdp-text-2">
            <li>
              <strong className="text-fdp-text-1">Step 1: Select Your League</strong>
              <p className="text-sm mt-1">Choose a league from the dropdown to auto-load players and apply correct scoring settings.</p>
            </li>
            <li>
              <strong className="text-fdp-text-1">Step 2: Add Players</strong>
              <p className="text-sm mt-1">Use the search boxes to find players. Type a name and select from the dropdown.</p>
            </li>
            <li>
              <strong className="text-fdp-text-1">Step 3: Add Draft Picks (Optional)</strong>
              <p className="text-sm mt-1">Click "Add Pick" to include draft picks. Select year and round.</p>
            </li>
            <li>
              <strong className="text-fdp-text-1">Step 4: Add FAAB (Optional)</strong>
              <p className="text-sm mt-1">Enter waiver budget amounts if FAAB is part of the trade.</p>
            </li>
            <li>
              <strong className="text-fdp-text-1">Step 5: Review Results</strong>
              <p className="text-sm mt-1">See total values, fairness assessment, and detailed breakdowns.</p>
            </li>
          </ol>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Understanding Values</h3>
          <div className="space-y-3 text-fdp-text-2">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Player Values</h4>
              <p className="text-sm">
                Values are aggregated from KeepTradeCut, SportsData.io, and our proprietary algorithms. They adjust for:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm">
                <li>League format (Superflex, TE Premium, IDP)</li>
                <li>Player age and experience</li>
                <li>Injury status</li>
                <li>Team situation and opportunity</li>
                <li>Recent performance trends</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Draft Pick Values</h4>
              <p className="text-sm">
                Picks are valued based on historical ADP data and expected player value at that selection.
                Future picks depreciate ~13% per year.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Fairness Scale</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Fair Trade:</strong> Values within 10% of each other</li>
                <li><strong>Slight Winner:</strong> 10-25% value difference</li>
                <li><strong>Clear Winner:</strong> 25%+ value difference</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Pro Tips</h3>
          <ul className="space-y-2 text-sm text-fdp-text-2">
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Context matters:</strong> Values don't account for your team needs. A fair trade on paper might be unfair for your roster construction.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Competing vs rebuilding:</strong> Contenders should prioritize win-now players. Rebuilders should accumulate picks and young talent.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>League context:</strong> Player values vary by league. Your league mates might value players differently than the consensus.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Save your trades:</strong> Track your deals to see long-term success rates and learn from past decisions.</span>
            </li>
          </ul>
        </div>
      </div>
    ),

    'power-rankings': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Power Rankings Guide</h2>
          <p className="text-fdp-text-2 mb-4">
            Understand true team strength beyond win-loss records.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">What Are Power Rankings?</h3>
          <p className="text-fdp-text-2 mb-4">
            Power Rankings evaluate the total dynasty value of each team in your league by analyzing:
          </p>
          <ul className="space-y-2 text-fdp-text-2">
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Roster Value:</strong> Combined value of all rostered players</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Draft Capital:</strong> Owned picks for the next 3 years</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>FAAB Remaining:</strong> Available waiver budget</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Win-Loss Record:</strong> Current season performance</span>
            </li>
          </ul>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Reading the Rankings</h3>
          <div className="space-y-3 text-fdp-text-2 text-sm">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Total Value Score</h4>
              <p>
                The aggregate value of a team's assets. Higher is better. A team with 5,000 total value has significantly more dynasty capital than one with 3,000.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Top Players Section</h4>
              <p>
                Shows the 5 most valuable players on each roster. This helps identify teams with star power vs depth.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Draft Pick Assets</h4>
              <p>
                Teams with extra picks (especially early ones) have more rebuild/retool flexibility.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Common Scenarios</h3>
          <ul className="space-y-3 text-sm text-fdp-text-2">
            <li>
              <strong className="text-fdp-text-1">High Rank, Bad Record:</strong> Strong dynasty team having a down year. Don't panic - focus on long-term value.
            </li>
            <li>
              <strong className="text-fdp-text-1">Low Rank, Good Record:</strong> Overperforming with aging roster. Consider selling high before decline.
            </li>
            <li>
              <strong className="text-fdp-text-1">Top Rank by Big Margin:</strong> Dynasty juggernaut. Other teams should consider teaming up or rebuilding.
            </li>
            <li>
              <strong className="text-fdp-text-1">Many Teams Clustered:</strong> Competitive league. Small moves can swing rankings significantly.
            </li>
          </ul>
        </div>
      </div>
    ),

    'playoff-simulator': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Playoff Simulator Guide</h2>
          <p className="text-fdp-text-2 mb-4">
            Predict playoff probabilities with advanced Monte Carlo simulations.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">How It Works</h3>
          <p className="text-fdp-text-2 mb-4">
            The Playoff Simulator runs 10,000+ simulations of your remaining season games to calculate probabilities:
          </p>
          <ol className="space-y-3 text-fdp-text-2">
            <li>
              <strong className="text-fdp-text-1">1. Current Standings:</strong> Starts with actual records and points
            </li>
            <li>
              <strong className="text-fdp-text-1">2. Team Strength:</strong> Calculates win probability based on points for/against and roster value
            </li>
            <li>
              <strong className="text-fdp-text-1">3. Simulates Games:</strong> Randomly determines outcomes of remaining games based on probabilities
            </li>
            <li>
              <strong className="text-fdp-text-1">4. Records Results:</strong> Tracks final standings across all simulations
            </li>
            <li>
              <strong className="text-fdp-text-1">5. Calculates Odds:</strong> Aggregates results to show playoff %, bye %, championship %
            </li>
          </ol>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Understanding the Results</h3>
          <div className="space-y-4 text-fdp-text-2">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Playoff Odds</h4>
              <p className="text-sm">
                Percentage of simulations where the team makes the playoffs. 50% = coin flip, 90%+ = very likely.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">First-Round Bye Odds</h4>
              <p className="text-sm">
                Probability of finishing in the top 2 seeds (or top 4 in larger leagues) to skip the first playoff week.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Championship Odds</h4>
              <p className="text-sm">
                Likelihood of winning it all. Accounts for both making playoffs and winning through the bracket.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Projected Wins</h4>
              <p className="text-sm">
                Expected final win total based on remaining schedule and team strength.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-1">Seed Distribution</h4>
              <p className="text-sm">
                Shows the probability of finishing at each seed. Helps understand range of outcomes.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Strategic Insights</h3>
          <ul className="space-y-2 text-sm text-fdp-text-2">
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Below 10% playoff odds?</strong> Consider selling veterans for future assets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Above 80% playoff odds?</strong> Time to go all-in for the championship</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>High bye odds?</strong> Extra week of rest can be huge for injured players</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fdp-accent-1 flex-shrink-0">•</span>
              <span><strong>Bubble team (40-60%)?</strong> One or two moves could swing your season</span>
            </li>
          </ul>
        </div>
      </div>
    ),

    'roster-tools': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Roster Management Tools</h2>
          <p className="text-fdp-text-2 mb-4">
            Optimize your weekly roster decisions and long-term planning.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-fdp-accent-1" />
              Lineup Optimizer
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Recommends your optimal starting lineup based on player values and projections.
            </p>
            <ul className="space-y-2 text-sm text-fdp-text-2">
              <li>• Automatically fills all required positions</li>
              <li>• Prioritizes highest-value players</li>
              <li>• Accounts for injuries and bye weeks</li>
              <li>• Suggests flex position optimization</li>
            </ul>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-fdp-accent-1" />
              Waiver Assistant
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Identifies top waiver wire pickups based on your roster needs.
            </p>
            <ul className="space-y-2 text-sm text-fdp-text-2">
              <li>• Scans all available free agents</li>
              <li>• Compares to your current roster</li>
              <li>• Prioritizes by value upgrade potential</li>
              <li>• Suggests drop candidates</li>
            </ul>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-fdp-accent-1" />
              Roster Health
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Track injuries and bye weeks across your entire roster.
            </p>
            <ul className="space-y-2 text-sm text-fdp-text-2">
              <li>• Real-time injury status updates</li>
              <li>• Bye week planning calendar</li>
              <li>• Depth chart analysis</li>
              <li>• Injury replacement suggestions</li>
            </ul>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-fdp-accent-1" />
              Value Trend Tracker
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Monitor player value changes over time to identify buy-low and sell-high opportunities.
            </p>
            <ul className="space-y-2 text-sm text-fdp-text-2">
              <li>• Historical value charts</li>
              <li>• Trend indicators (rising/falling)</li>
              <li>• Volatility scoring</li>
              <li>• Trade timing recommendations</li>
            </ul>
          </div>
        </div>
      </div>
    ),

    'draft-keeper': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Draft & Keeper Tools</h2>
          <p className="text-fdp-text-2 mb-4">
            Dominate your draft and make smart keeper decisions.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Draft Kit</h3>
          <p className="text-fdp-text-2 mb-4">
            Your complete draft day companion with real-time rankings and recommendations.
          </p>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-2">Features:</h4>
              <ul className="space-y-2 text-sm text-fdp-text-2">
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <span><strong>Dynamic Rankings:</strong> Player rankings update based on league settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <span><strong>Draft Tracker:</strong> Mark players as drafted to see best available</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <span><strong>Position Targets:</strong> Track positional needs during draft</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <span><strong>Value Alerts:</strong> Get notified of value drops to your pick</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-fdp-accent-1">•</span>
                  <span><strong>Tier-Based Rankings:</strong> See natural breakpoints between players</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Keeper Calculator</h3>
          <p className="text-fdp-text-2 mb-4">
            Evaluate keeper decisions with advanced value analysis.
          </p>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-2">How to Use:</h4>
              <ol className="space-y-2 text-sm text-fdp-text-2">
                <li>1. Enter your potential keepers and their draft round costs</li>
                <li>2. Review value score (player value - pick value = keeper surplus)</li>
                <li>3. Compare all options side-by-side</li>
                <li>4. Make informed decisions on which players to keep</li>
              </ol>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-fdp-text-1 mb-2">Keeper Strategy:</h4>
              <ul className="space-y-2 text-sm text-fdp-text-2">
                <li>• <strong>Positive Value:</strong> Player worth more than the pick cost = good keeper</li>
                <li>• <strong>Negative Value:</strong> Might be better to get the pick back</li>
                <li>• <strong>Young Stars:</strong> Often best keepers with multi-year upside</li>
                <li>• <strong>Late Round Gems:</strong> Breakout players in late rounds = maximum value</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-3">Draft Day Pro Tips</h3>
          <ul className="space-y-2 text-sm text-fdp-text-2">
            <li>• Don't reach for need - draft best available and trade later</li>
            <li>• In Superflex, prioritize QBs early (they're scarce!)</li>
            <li>• Target handcuff RBs in later rounds for insurance</li>
            <li>• Stream kickers and defenses - don't draft early</li>
            <li>• Watch for rookie landing spots - situation matters</li>
            <li>• Consider bye weeks when drafting late-round depth</li>
          </ul>
        </div>
      </div>
    ),

    'advanced': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Advanced Features</h2>
          <p className="text-fdp-text-2 mb-4">
            Power features for serious fantasy players.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-fdp-accent-1" />
              Trade Finder
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Automatically discovers win-win trade opportunities with all league teams.
            </p>
            <div className="text-sm text-fdp-text-2">
              <p className="mb-2"><strong className="text-fdp-text-1">How it works:</strong></p>
              <ol className="space-y-1 ml-4">
                <li>1. Analyzes your roster vs every other team</li>
                <li>2. Identifies positional surpluses and deficits</li>
                <li>3. Suggests trades where both sides gain value</li>
                <li>4. Ranks opportunities by mutual benefit</li>
              </ol>
            </div>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-fdp-accent-1" />
              Trade Block Marketplace
            </h3>
            <p className="text-fdp-text-2 mb-3">
              See which players are available across your league and their current values.
            </p>
            <div className="text-sm text-fdp-text-2">
              <ul className="space-y-1">
                <li>• View all trade block players league-wide</li>
                <li>• Sort by position, value, or team</li>
                <li>• Quick-add to trade analyzer</li>
                <li>• Contact owners directly</li>
              </ul>
            </div>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-fdp-accent-1" />
              Counter Offer Generator
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Received a bad trade offer? Generate fair counter-offers automatically.
            </p>
            <div className="text-sm text-fdp-text-2">
              <p className="mb-2"><strong className="text-fdp-text-1">Process:</strong></p>
              <ol className="space-y-1 ml-4">
                <li>1. Enter the original trade offer</li>
                <li>2. AI suggests balanced adjustments</li>
                <li>3. Add/remove players to balance value</li>
                <li>4. Save and share the counter-offer</li>
              </ol>
            </div>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-fdp-accent-1" />
              Championship Calculator
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Project your championship odds accounting for schedule, matchups, and roster strength.
            </p>
            <div className="text-sm text-fdp-text-2">
              <ul className="space-y-1">
                <li>• Weekly win probability vs each opponent</li>
                <li>• Playoff bracket projections</li>
                <li>• Path to championship analysis</li>
                <li>• Roster move impact scenarios</li>
              </ul>
            </div>
          </div>

          <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-fdp-accent-1" />
              Rivalry Tracker
            </h3>
            <p className="text-fdp-text-2 mb-3">
              Track head-to-head records and matchup history with league rivals.
            </p>
            <div className="text-sm text-fdp-text-2">
              <ul className="space-y-1">
                <li>• All-time records vs each opponent</li>
                <li>• Average scoring matchups</li>
                <li>• Playoff history</li>
                <li>• Trade history between teams</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),

    'tips': (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-fdp-text-1 mb-4">Tips & Best Practices</h2>
          <p className="text-fdp-text-2 mb-4">
            Pro strategies to maximize your fantasy success.
          </p>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4">Dynasty Strategy</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-2">Competing for Championships</h4>
              <ul className="space-y-2 text-sm text-fdp-text-2">
                <li>• Trade future picks for proven veterans</li>
                <li>• Prioritize players with stable situations</li>
                <li>• Target handcuff RBs for injury insurance</li>
                <li>• Don't overpay for one player - build depth</li>
                <li>• Plan ahead for bye weeks and playoff schedule</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-fdp-text-1 mb-2">Rebuilding Smartly</h4>
              <ul className="space-y-2 text-sm text-fdp-text-2">
                <li>• Sell aging veterans before value crashes</li>
                <li>• Accumulate draft picks (especially 1sts)</li>
                <li>• Target undervalued young players</li>
                <li>• Don't rush - patience wins rebuilds</li>
                <li>• Stream defenses/kickers - don't roster permanently</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4">Trade Tactics</h3>
          <ul className="space-y-3 text-sm text-fdp-text-2">
            <li>
              <strong className="text-fdp-text-1">Start Negotiations Low:</strong> You can always add more, but can't take back an overpay.
            </li>
            <li>
              <strong className="text-fdp-text-1">Target Underperforming Studs:</strong> Buy players whose value has dipped due to poor recent games.
            </li>
            <li>
              <strong className="text-fdp-text-1">Sell High on Breakouts:</strong> Cash in on one-week wonders before regression.
            </li>
            <li>
              <strong className="text-fdp-text-1">Package Depth for Studs:</strong> Two bench players often less valuable than one starter.
            </li>
            <li>
              <strong className="text-fdp-text-1">Know Your League:</strong> Some owners overvalue/undervalue certain positions or players.
            </li>
            <li>
              <strong className="text-fdp-text-1">Be Active But Patient:</strong> Make offers frequently, but don't force bad deals.
            </li>
          </ul>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4">Waiver Wire Wins</h3>
          <ul className="space-y-2 text-sm text-fdp-text-2">
            <li>• Add players Wednesday morning (first chance after waivers clear)</li>
            <li>• Monitor target share for WRs (20%+ is startable)</li>
            <li>• Handcuff your elite RBs even if it costs a bench spot</li>
            <li>• Stream defenses based on matchups (vs bad offenses)</li>
            <li>• Don't burn all FAAB early - save for season-winners</li>
            <li>• Add players BEFORE they break out (watch snap counts)</li>
          </ul>
        </div>

        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4">Common Mistakes to Avoid</h3>
          <ul className="space-y-2 text-sm text-fdp-text-2">
            <li>❌ Overvaluing your own players (avoid emotional attachments)</li>
            <li>❌ Chasing last week's points (variance is real)</li>
            <li>❌ Ignoring bye weeks when trading</li>
            <li>❌ Holding too many QBs/TEs/Ks (roster valuable positions)</li>
            <li>❌ Trading based on team name recognition alone</li>
            <li>❌ Neglecting league-specific scoring settings</li>
            <li>❌ Making panic moves after one bad week</li>
            <li>❌ Accepting the first offer without negotiating</li>
          </ul>
        </div>

        <div className="bg-fdp-surface-2 border border-fdp-border-1 rounded-lg p-6">
          <h3 className="text-lg font-bold text-fdp-text-1 mb-4">Weekly Routine</h3>
          <div className="space-y-3 text-sm text-fdp-text-2">
            <p><strong className="text-fdp-text-1">Sunday Morning:</strong> Set lineups, check injury reports</p>
            <p><strong className="text-fdp-text-1">Monday:</strong> Review results, check waivers for pickups</p>
            <p><strong className="text-fdp-text-1">Wednesday:</strong> Process waiver claims, scan trade market</p>
            <p><strong className="text-fdp-text-1">Thursday:</strong> Monitor practice reports for TNF players</p>
            <p><strong className="text-fdp-text-1">Friday:</strong> Check lineup one more time before lock</p>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 flex">
      {/* Sidebar */}
      <div className="w-64 bg-fdp-surface-1 border-r border-fdp-border-1 p-6 hidden md:block">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-6 h-6 text-fdp-accent-1" />
          <h2 className="text-lg font-bold text-fdp-text-1">Help Center</h2>
        </div>
        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                  activeSection === section.id
                    ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                    : 'text-fdp-text-2 hover:bg-fdp-surface-2'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Mobile Section Selector */}
          <div className="md:hidden mb-6">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-1 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>

          {/* Close Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onClose}
              className="text-fdp-text-3 hover:text-fdp-text-1 transition-colors"
              aria-label="Close Help"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div>{content[activeSection]}</div>

          {/* Contact Section */}
          <div className="mt-12 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-lg p-6 text-fdp-bg-0">
            <h3 className="text-lg font-bold mb-2">Need More Help?</h3>
            <p className="mb-4 opacity-90">
              Can't find what you're looking for? Our support team is here to help!
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="mailto:contact@fantasydraftpros.com"
                className="px-4 py-2 bg-fdp-bg-0 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all font-semibold backdrop-blur"
              >
                Email Support
              </a>
              <button
                onClick={() => setActiveSection('getting-started')}
                className="px-4 py-2 bg-fdp-bg-0 bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all font-semibold backdrop-blur"
              >
                Back to Start
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, UserLeague } from '../lib/supabase';
import { LogOut, Plus, Settings, TrendingUp, Users, Trophy, Activity, History, Search, Shield, Clipboard, FileText, Swords, MessageCircle, Bell, Newspaper, Share2, ArrowLeftRight, ShoppingCart, RefreshCw, Calendar, DollarSign, Mail, Award, Edit, Sparkles, Target } from 'lucide-react';
import { LeagueManager } from './LeagueManager';
import { useToast } from './Toast';
import TradeAnalyzer from './TradeAnalyzer';
import PowerRankings from './PowerRankings';
import PlayoffSimulator from './PlayoffSimulator';
import TradeHistory from './TradeHistory';
import WaiverAssistant from './WaiverAssistant';
import LineupOptimizer from './LineupOptimizer';
import ValueTrendTracker from './ValueTrendTracker';
import ChampionshipCalculator from './ChampionshipCalculator';
import TradeFinder from './TradeFinder';
import TradeBlockMarketplace from './TradeBlockMarketplace';
import CounterOfferGenerator from './CounterOfferGenerator';
import DraftKit from './DraftKit';
import KeeperCalculator from './KeeperCalculator';
import RosterHealth from './RosterHealth';
import WeeklyRecap from './WeeklyRecap';
import RivalryTracker from './RivalryTracker';
import LeagueChat from './LeagueChat';
import NotificationsPanel from './NotificationsPanel';
import PlayerNewsFeed from './PlayerNewsFeed';
import ExportShare from './ExportShare';
import { PlayerValues } from './PlayerValues';
import { Contact } from './Contact';
import Footer from './Footer';
import KTCAdminSync from './KTCAdminSync';
import KTCQBRankings from './KTCQBRankings';
import KTCRBRankings from './KTCRBRankings';
import KTCMultiPositionSync from './KTCMultiPositionSync';
import UnifiedRankings from './UnifiedRankings';
import PlayerSearch from './PlayerSearch';
import PlayerDetail from './PlayerDetail';
import SleeperLeagueAnalysis from './SleeperLeagueAnalysis';
import RBContextEditor from './RBContextEditor';
import RBContextSuggestions from './RBContextSuggestions';
import RookiePickValues from './RookiePickValues';
import IDPRankings from './IDPRankings';
import IDPAdminUpload from './IDPAdminUpload';
import TeamAdvice from './TeamAdvice';
import MarketTrends from './MarketTrends';
import WatchlistPanel from './WatchlistPanel';
import AlertsDropdown from './AlertsDropdown';

type TabType = 'trade' | 'rankings' | 'playoffs' | 'history' | 'waiver' | 'lineup' | 'trends' | 'championship' | 'tradeFinder' | 'tradeBlock' | 'counterOffer' | 'draft' | 'keeper' | 'health' | 'recap' | 'rivalry' | 'chat' | 'notifications' | 'news' | 'export' | 'values' | 'contact' | 'ktcAdmin' | 'ktcRankings' | 'ktcRBRankings' | 'rbContext' | 'rbSuggestions' | 'pickValues' | 'idpRankings' | 'idpUpload' | 'ktcMultiSync' | 'unifiedRankings' | 'sleeperAnalysis' | 'teamAdvice' | 'market' | 'watchlist';

interface DashboardProps {
  onNavigate?: (page: 'home' | 'faq' | 'help') => void;
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [currentLeague, setCurrentLeague] = useState<UserLeague | null>(null);
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [showManageLeagues, setShowManageLeagues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('trade');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadLeagues();
    }
  }, [user]);

  const loadLeagues = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_leagues')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeagues(data || []);
      if (data && data.length > 0 && !currentLeague) {
        setCurrentLeague(data[0]);
      }
    } catch (error) {
      console.error('Error loading leagues:', error);
      showToast('Failed to load your leagues. Please try refreshing the page.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeague = async (
    leagueId: string,
    leagueName: string,
    teamName: string,
    isSuperflex: boolean,
    platform: 'sleeper' | 'espn' | 'yahoo' | 'nfl' = 'sleeper',
    platformSettings?: { espn_s2?: string; swid?: string; yahoo_access_token?: string }
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('user_leagues').insert({
        user_id: user.id,
        league_id: leagueId,
        league_name: leagueName || `League ${leagueId}`,
        team_name: teamName,
        is_superflex: isSuperflex,
        is_active: true,
        platform: platform,
        platform_settings: platformSettings || {},
      });

      if (error) throw error;

      await loadLeagues();
      setShowAddLeague(false);
      showToast(`${platform.charAt(0).toUpperCase() + platform.slice(1)} league added successfully!`, 'success');
    } catch (error: any) {
      console.error('Error adding league:', error);
      if (error.message?.includes('duplicate')) {
        showToast('This league is already saved to your account.', 'error');
      } else {
        showToast('Failed to add league. Please try again.', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
        <div className="text-fdp-text-1 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-fdp-surface-1 to-fdp-bg-1 border-b border-fdp-border-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/FDP2.png"
                alt="Fantasy Draft Pros"
                className="h-14 w-auto object-contain"
                onError={(e) => {
                  console.error('Logo failed to load');
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-2xl font-bold text-fdp-text-1">Fantasy Draft Pros</h1>
                <p className="text-fdp-text-3 text-sm">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertsDropdown onSelectPlayer={(playerId) => setSelectedPlayerId(playerId)} />
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 bg-fdp-neg hover:bg-opacity-90 text-white rounded-lg transition-all transform hover:-translate-y-0.5"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        {/* League Selector */}
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-fdp-text-1 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Leagues
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddLeague(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" />
                Add League
              </button>
              <button
                onClick={() => setShowManageLeagues(true)}
                className="flex items-center gap-2 px-4 py-2 bg-fdp-surface-2 hover:bg-fdp-border-1 text-fdp-text-1 rounded-lg transition-all transform hover:-translate-y-0.5"
              >
                <Settings className="w-4 h-4" />
                Manage
              </button>
            </div>
          </div>

          {leagues.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-fdp-text-3 mb-4">No leagues saved yet. Add your first league to get started!</p>
              <button
                onClick={() => setShowAddLeague(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
              >
                <Plus className="w-5 h-5" />
                Add Your First League
              </button>
            </div>
          ) : (
            <div>
              <select
                value={currentLeague?.id || ''}
                onChange={(e) => {
                  const league = leagues.find(l => l.id === e.target.value);
                  setCurrentLeague(league || null);
                }}
                className="w-full px-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none text-lg font-medium"
              >
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.league_name} ({league.league_id})
                  </option>
                ))}
              </select>

              {currentLeague && (
                <div className="mt-4 flex gap-4 text-sm text-fdp-text-3">
                  {currentLeague.team_name && (
                    <span className="font-medium">Team: {currentLeague.team_name}</span>
                  )}
                  {currentLeague.is_superflex && (
                    <span className="px-2 py-1 bg-fdp-accent-1 bg-opacity-20 text-fdp-accent-2 rounded-full text-xs font-semibold">
                      Superflex
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Player Search */}
        <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-fdp-text-1 mb-2">Search Dynasty Player Values</h2>
            <p className="text-fdp-text-3">Find any player to see their value history and trends</p>
          </div>
          <div className="flex justify-center">
            <PlayerSearch
              onSelectPlayer={(playerId) => setSelectedPlayerId(playerId)}
              placeholder="Search for a player (e.g., Patrick Mahomes, Drake Maye)..."
              autoFocus={false}
            />
          </div>
        </div>

        {selectedPlayerId ? (
          <PlayerDetail
            playerId={selectedPlayerId}
            onBack={() => setSelectedPlayerId(null)}
          />
        ) : (
          <>
            {/* Main Content */}
            {currentLeague && (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-lg p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">Core Features</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={TrendingUp} label="Trade Analyzer" shortLabel="Trade" tab="trade" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Trophy} label="Power Rankings" shortLabel="Rankings" tab="rankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Activity} label="Playoff Odds" shortLabel="Playoffs" tab="playoffs" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={History} label="Trade History" shortLabel="History" tab="history" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">Analytics & Insights</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Target} label="Team Advice" shortLabel="Advice" tab="teamAdvice" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Award} label="Watchlist" shortLabel="Watch" tab="watchlist" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Activity} label="Market Trends" shortLabel="Market" tab="market" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={DollarSign} label="Player Values" shortLabel="Values" tab="values" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Search} label="Waiver Assistant" shortLabel="Waiver" tab="waiver" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Users} label="Lineup Optimizer" shortLabel="Lineup" tab="lineup" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={TrendingUp} label="Value Trends" shortLabel="Trends" tab="trends" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Trophy} label="Championship Odds" shortLabel="Champion" tab="championship" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">League Analysis</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Users} label="Sleeper Import" shortLabel="Sleeper" tab="sleeperAnalysis" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">Trading Tools</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={ArrowLeftRight} label="Trade Finder" shortLabel="Finder" tab="tradeFinder" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={ShoppingCart} label="Trade Block" shortLabel="Block" tab="tradeBlock" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={RefreshCw} label="Counter Offer" shortLabel="Counter" tab="counterOffer" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">Draft & Management</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Clipboard} label="Draft Kit" shortLabel="Draft" tab="draft" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Shield} label="Keeper Calculator" shortLabel="Keeper" tab="keeper" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Calendar} label="Roster Health" shortLabel="Health" tab="health" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">League Social</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={FileText} label="Weekly Recap" shortLabel="Recap" tab="recap" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Swords} label="Rivalry Tracker" shortLabel="Rivalry" tab="rivalry" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={MessageCircle} label="League Chat" shortLabel="Chat" tab="chat" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Bell} label="Notifications" shortLabel="Alerts" tab="notifications" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">Data Management</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Shield} label="KTC Admin Sync" shortLabel="Admin" tab="ktcAdmin" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Trophy} label="QB Rankings" shortLabel="QBs" tab="ktcRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Award} label="RB Rankings" shortLabel="RBs" tab="ktcRBRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Edit} label="RB Context" shortLabel="Context" tab="rbContext" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Sparkles} label="RB Suggestions" shortLabel="AI Suggest" tab="rbSuggestions" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Calendar} label="Rookie Pick Values" shortLabel="Picks" tab="pickValues" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Shield} label="IDP Rankings" shortLabel="IDP" tab="idpRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Upload} label="IDP Upload" shortLabel="Upload" tab="idpUpload" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={RefreshCw} label="Multi-Position Sync" shortLabel="Multi" tab="ktcMultiSync" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={TrendingUp} label="All Rankings" shortLabel="Rankings" tab="unifiedRankings" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">News & Support</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Newspaper} label="Player News" shortLabel="News" tab="news" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Share2} label="Export & Share" shortLabel="Share" tab="export" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Mail} label="Contact Us" shortLabel="Contact" tab="contact" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'trade' && <TradeAnalyzer leagueId={currentLeague.league_id} onTradeSaved={() => setActiveTab('history')} />}
              {activeTab === 'teamAdvice' && <TeamAdvice sleeperLeagueId={currentLeague.league_id} />}
              {activeTab === 'watchlist' && <WatchlistPanel onSelectPlayer={(playerId) => setSelectedPlayerId(playerId)} />}
              {activeTab === 'market' && <MarketTrends onSelectPlayer={(playerId) => setSelectedPlayerId(playerId)} />}
              {activeTab === 'rankings' && <PowerRankings leagueId={currentLeague.league_id} />}
              {activeTab === 'playoffs' && <PlayoffSimulator leagueId={currentLeague.league_id} />}
              {activeTab === 'history' && <TradeHistory leagueId={currentLeague.league_id} />}
              {activeTab === 'values' && <PlayerValues leagueId={currentLeague.league_id} isSuperflex={currentLeague.is_superflex} />}
              {activeTab === 'waiver' && <WaiverAssistant leagueId={currentLeague.league_id} rosterId="1" userId={user?.id || ''} />}
              {activeTab === 'lineup' && <LineupOptimizer leagueId={currentLeague.league_id} rosterId="1" />}
              {activeTab === 'trends' && <ValueTrendTracker leagueId={currentLeague.league_id} />}
              {activeTab === 'championship' && <ChampionshipCalculator leagueId={currentLeague.league_id} />}
              {activeTab === 'tradeFinder' && <TradeFinder leagueId={currentLeague.league_id} rosterId="1" />}
              {activeTab === 'tradeBlock' && <TradeBlockMarketplace leagueId={currentLeague.league_id} userId={user?.id || ''} />}
              {activeTab === 'counterOffer' && <CounterOfferGenerator />}
              {activeTab === 'draft' && <DraftKit leagueId={currentLeague.league_id} userId={user?.id || ''} />}
              {activeTab === 'keeper' && <KeeperCalculator leagueId={currentLeague.league_id} rosterId="1" />}
              {activeTab === 'health' && <RosterHealth leagueId={currentLeague.league_id} rosterId="1" />}
              {activeTab === 'recap' && <WeeklyRecap leagueId={currentLeague.league_id} />}
              {activeTab === 'rivalry' && <RivalryTracker leagueId={currentLeague.league_id} />}
              {activeTab === 'chat' && <LeagueChat leagueId={currentLeague.league_id} userId={user?.id || ''} username={user?.email || 'User'} />}
              {activeTab === 'notifications' && <NotificationsPanel userId={user?.id || ''} leagueId={currentLeague.league_id} />}
              {activeTab === 'news' && <PlayerNewsFeed />}
              {activeTab === 'export' && <ExportShare leagueId={currentLeague.league_id} rosterId="1" />}
              {activeTab === 'contact' && <Contact />}
              {activeTab === 'ktcAdmin' && <KTCAdminSync />}
              {activeTab === 'ktcRankings' && <KTCQBRankings />}
              {activeTab === 'ktcRBRankings' && <KTCRBRankings />}
              {activeTab === 'rbContext' && <RBContextEditor />}
              {activeTab === 'rbSuggestions' && <RBContextSuggestions />}
              {activeTab === 'pickValues' && <RookiePickValues />}
              {activeTab === 'idpRankings' && <IDPRankings />}
              {activeTab === 'idpUpload' && <IDPAdminUpload />}
              {activeTab === 'ktcMultiSync' && <KTCMultiPositionSync />}
              {activeTab === 'unifiedRankings' && <UnifiedRankings />}
              {activeTab === 'sleeperAnalysis' && <SleeperLeagueAnalysis />}
            </div>
          </div>
        )}
          </>
        )}

        {/* Modals */}
        {showAddLeague && (
          <AddLeagueModal
            onClose={() => setShowAddLeague(false)}
            onAdd={handleAddLeague}
          />
        )}

        {showManageLeagues && (
          <LeagueManager
            leagues={leagues}
            onClose={() => setShowManageLeagues(false)}
            onUpdate={loadLeagues}
          />
        )}
      </div>

      <Footer onNavigate={onNavigate} />
    </div>
  );
}

interface NavButtonProps {
  icon: any;
  label: string;
  shortLabel: string;
  tab: TabType;
  activeTab: TabType;
  onClick: (tab: TabType) => void;
}

function NavButton({ icon: Icon, label, shortLabel, tab, activeTab, onClick }: NavButtonProps) {
  return (
    <button
      onClick={() => onClick(tab)}
      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold transition-all ${
        activeTab === tab
          ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 shadow-lg'
          : 'bg-fdp-surface-2 text-fdp-text-2 hover:bg-fdp-border-1'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline text-sm">{label}</span>
      <span className="sm:hidden text-sm">{shortLabel}</span>
    </button>
  );
}

interface AddLeagueModalProps {
  onClose: () => void;
  onAdd: (
    leagueId: string,
    leagueName: string,
    teamName: string,
    isSuperflex: boolean,
    platform: 'sleeper' | 'espn' | 'yahoo' | 'nfl',
    platformSettings?: { espn_s2?: string; swid?: string; yahoo_access_token?: string }
  ) => void;
}

function AddLeagueModal({ onClose, onAdd }: AddLeagueModalProps) {
  const [platform, setPlatform] = useState<'sleeper' | 'espn' | 'yahoo' | 'nfl'>('sleeper');
  const [leagueId, setLeagueId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isSuperflex, setIsSuperflex] = useState(false);
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueId.trim()) {
      alert('Please enter a League ID');
      return;
    }
    if (platform === 'espn' && (!espnS2.trim() || !swid.trim())) {
      alert('ESPN leagues require both espn_s2 and SWID cookies');
      return;
    }
    onAdd(leagueId.trim(), leagueName.trim(), teamName.trim(), isSuperflex, platform, {
      espn_s2: espnS2.trim(),
      swid: swid.trim(),
    });
  };

  const platformInstructions: Record<string, string> = {
    sleeper: 'Open your Sleeper league → Copy the League ID from the URL (e.g., sleeper.com/leagues/123456789)',
    espn: 'Open ESPN Fantasy → F12 Developer Tools → Application → Cookies → Copy espn_s2 and SWID values',
    yahoo: 'Yahoo integration coming soon! For now, public league IDs may work with limited features.',
    nfl: 'NFL.com integration is coming soon! Use Sleeper or ESPN in the meantime.',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-xl max-w-md w-full p-6 my-8">
        <h3 className="text-xl font-bold text-fdp-text-1 mb-4">Add New League</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-2">
              Fantasy Platform *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['sleeper', 'espn', 'yahoo', 'nfl'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  disabled={p === 'yahoo' || p === 'nfl'}
                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                    platform === p
                      ? 'bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0'
                      : p === 'yahoo' || p === 'nfl'
                      ? 'bg-fdp-surface-2 text-fdp-text-3 cursor-not-allowed opacity-50'
                      : 'bg-fdp-surface-2 text-fdp-text-1 hover:bg-fdp-border-1'
                  }`}
                >
                  {p === 'sleeper' && '🛌 Sleeper'}
                  {p === 'espn' && '🏈 ESPN'}
                  {p === 'yahoo' && '🟣 Yahoo'}
                  {p === 'nfl' && '🏆 NFL.com'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="mt-2 text-xs text-fdp-accent-1 hover:underline"
            >
              {showInstructions ? 'Hide' : 'Show'} instructions
            </button>
            {showInstructions && (
              <div className="mt-2 p-3 bg-fdp-surface-2 rounded-lg text-xs text-fdp-text-2">
                {platformInstructions[platform]}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              {platform === 'sleeper' ? 'Sleeper ' : platform === 'espn' ? 'ESPN ' : platform === 'yahoo' ? 'Yahoo ' : 'NFL.com '}
              League ID *
            </label>
            <input
              type="text"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder={platform === 'sleeper' ? 'e.g., 123456789' : platform === 'espn' ? 'e.g., 987654' : 'League ID'}
              required
            />
          </div>

          {platform === 'espn' && (
            <>
              <div>
                <label className="block text-sm font-medium text-fdp-text-2 mb-1">
                  espn_s2 Cookie *
                </label>
                <input
                  type="text"
                  value={espnS2}
                  onChange={(e) => setEspnS2(e.target.value)}
                  className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none font-mono text-xs"
                  placeholder="Long alphanumeric string"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fdp-text-2 mb-1">
                  SWID Cookie *
                </label>
                <input
                  type="text"
                  value={swid}
                  onChange={(e) => setSwid(e.target.value)}
                  className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none font-mono text-xs"
                  placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              League Name (optional)
            </label>
            <input
              type="text"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder="My Dynasty League"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              Your Team Name (optional)
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder="My Team"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isSuperflex"
              checked={isSuperflex}
              onChange={(e) => setIsSuperflex(e.target.checked)}
              className="w-4 h-4 text-fdp-accent-1 border-fdp-border-1 rounded focus:ring-fdp-accent-1"
            />
            <label htmlFor="isSuperflex" className="text-sm font-medium text-fdp-text-2">
              Superflex League?
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              Add League
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-fdp-surface-2 hover:bg-fdp-border-1 text-fdp-text-1 font-semibold py-2 px-4 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

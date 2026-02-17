import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, UserLeague } from '../lib/supabase';
import { SEASON_CONTEXT } from '../config/seasonContext';
import { LogOut, Plus, Settings, TrendingUp, Users, Trophy, Activity, History, Search, Shield, Clipboard, FileText, Swords, MessageCircle, Bell, Newspaper, Share2, ArrowLeftRight, ShoppingCart, RefreshCw, Calendar, DollarSign, Mail, Award, Edit, Sparkles, Target, Upload, Radio, Zap, ChevronRight, AlertCircle, X } from 'lucide-react';
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
import { AdminSyncHub } from './AdminSyncHub';
import TrendingPlayersPanel from './TrendingPlayersPanel';
import KTCQBRankings from './KTCQBRankings';
import KTCRBRankings from './KTCRBRankings';
import KTCWRRankings from './KTCWRRankings';
import KTCTERankings from './KTCTERankings';
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
import HeadshotAdmin from './HeadshotAdmin';
import AlertsDropdown from './AlertsDropdown';
import DynastyReportsIndex from './DynastyReportsIndex';
import DynastyReportPage from './DynastyReportPage';
import LatestReportWidget from './LatestReportWidget';
import PricingPage from './PricingPage';
import UpgradeModal from './UpgradeModal';
import SubscriptionBadge from './SubscriptionBadge';
import UsageMeter from './UsageMeter';
import { useSubscription } from '../hooks/useSubscription';

type TabType = 'trade' | 'rankings' | 'playoffs' | 'history' | 'waiver' | 'lineup' | 'trends' | 'championship' | 'tradeFinder' | 'tradeBlock' | 'counterOffer' | 'draft' | 'keeper' | 'health' | 'recap' | 'rivalry' | 'chat' | 'notifications' | 'news' | 'export' | 'values' | 'contact' | 'ktcAdmin' | 'ktcRankings' | 'ktcRBRankings' | 'ktcWRRankings' | 'ktcTERankings' | 'rbContext' | 'rbSuggestions' | 'pickValues' | 'idpRankings' | 'idpUpload' | 'ktcMultiSync' | 'unifiedRankings' | 'sleeperAnalysis' | 'teamAdvice' | 'market' | 'watchlist' | 'reports' | 'reportDetail' | 'pricing';

interface DashboardProps {
  onNavigate?: (page: 'home' | 'faq' | 'help' | 'contact') => void;
}

export function Dashboard({ onNavigate }: DashboardProps = {}) {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const { isPro } = useSubscription();
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [currentLeague, setCurrentLeague] = useState<UserLeague | null>(null);
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [showManageLeagues, setShowManageLeagues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('trade');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedReportSlug, setSelectedReportSlug] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | undefined>(undefined);

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
      const { error } = await supabase.from('user_leagues')
        .upsert({
          user_id: user.id,
          league_id: leagueId,
          league_name: leagueName || `League ${leagueId}`,
          team_name: teamName,
          is_superflex: isSuperflex,
          is_active: true,
          platform: platform,
          platform_settings: platformSettings || {},
        }, {
          onConflict: 'user_id,league_id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      await loadLeagues();
      setShowAddLeague(false);
      showToast(`${platform.charAt(0).toUpperCase() + platform.slice(1)} league added successfully!`, 'success');
    } catch (error: any) {
      console.error('Error adding league:', error);
      showToast('Failed to add league. Please try again.', 'error');
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
              <SubscriptionBadge onUpgrade={() => {
                setUpgradeFeature(undefined);
                setShowUpgradeModal(true);
              }} />
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

        {/* Usage Meters (Free Users Only) */}
        {!isPro && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <UsageMeter
              feature="trade_calc"
              onUpgrade={() => {
                setUpgradeFeature('Unlimited Trade Calculations');
                setShowUpgradeModal(true);
              }}
            />
            <UsageMeter
              feature="league_import"
              onUpgrade={() => {
                setUpgradeFeature('Unlimited League Imports');
                setShowUpgradeModal(true);
              }}
            />
          </div>
        )}

        {/* Latest Market Report Widget */}
        <div className="mb-6">
          <LatestReportWidget
            onSelectReport={(slug) => {
              setSelectedReportSlug(slug);
              setActiveTab('reportDetail');
            }}
          />
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
                    <NavButton icon={FileText} label="Market Reports" shortLabel="Reports" tab="reports" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Activity} label="Market Trends" shortLabel="Market" tab="market" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={TrendingUp} label="Trending Players" shortLabel="Trending" tab="trending" activeTab={activeTab} onClick={setActiveTab} />
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
                    <NavButton icon={RefreshCw} label="System Admin" shortLabel="Admin" tab="adminSync" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Shield} label="FDP Admin Sync" shortLabel="FDP" tab="ktcAdmin" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Trophy} label="QB Rankings" shortLabel="QBs" tab="ktcRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Award} label="RB Rankings" shortLabel="RBs" tab="ktcRBRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Radio} label="WR Rankings" shortLabel="WRs" tab="ktcWRRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Zap} label="TE Rankings" shortLabel="TEs" tab="ktcTERankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Edit} label="RB Context" shortLabel="Context" tab="rbContext" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Sparkles} label="RB Suggestions" shortLabel="AI Suggest" tab="rbSuggestions" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Calendar} label="Rookie Pick Values" shortLabel="Picks" tab="pickValues" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Shield} label="IDP Rankings" shortLabel="IDP" tab="idpRankings" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Upload} label="IDP Upload" shortLabel="Upload" tab="idpUpload" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Users} label="Headshot Admin" shortLabel="Headshots" tab="headshotAdmin" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={RefreshCw} label="Multi-Position Sync" shortLabel="Multi" tab="ktcMultiSync" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={TrendingUp} label="All Rankings" shortLabel="Rankings" tab="unifiedRankings" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">News & Support</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Newspaper} label="Player News" shortLabel="News" tab="news" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Share2} label="Export & Share" shortLabel="Share" tab="export" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Sparkles} label="Upgrade to Pro" shortLabel="Upgrade" tab="pricing" activeTab={activeTab} onClick={setActiveTab} />
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
              {activeTab === 'trending' && <TrendingPlayersPanel />}
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
              {activeTab === 'adminSync' && <AdminSyncHub />}
              {activeTab === 'ktcAdmin' && <KTCAdminSync />}
              {activeTab === 'ktcRankings' && <KTCQBRankings />}
              {activeTab === 'ktcRBRankings' && <KTCRBRankings />}
              {activeTab === 'ktcWRRankings' && <KTCWRRankings />}
              {activeTab === 'ktcTERankings' && <KTCTERankings />}
              {activeTab === 'rbContext' && <RBContextEditor />}
              {activeTab === 'rbSuggestions' && <RBContextSuggestions />}
              {activeTab === 'pickValues' && <RookiePickValues />}
              {activeTab === 'idpRankings' && <IDPRankings />}
              {activeTab === 'idpUpload' && <IDPAdminUpload />}
              {activeTab === 'headshotAdmin' && <HeadshotAdmin />}
              {activeTab === 'ktcMultiSync' && <KTCMultiPositionSync />}
              {activeTab === 'unifiedRankings' && <UnifiedRankings />}
              {activeTab === 'sleeperAnalysis' && <SleeperLeagueAnalysis />}
              {activeTab === 'reports' && (
                <DynastyReportsIndex
                  onSelectReport={(slug) => {
                    setSelectedReportSlug(slug);
                    setActiveTab('reportDetail');
                  }}
                />
              )}
              {activeTab === 'reportDetail' && selectedReportSlug && (
                <DynastyReportPage
                  slug={selectedReportSlug}
                  onBack={() => setActiveTab('reports')}
                  onSelectPlayer={(playerId) => setSelectedPlayerId(playerId)}
                />
              )}
              {activeTab === 'pricing' && (
                <PricingPage onBack={() => setActiveTab('trade')} />
              )}
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

        {showUpgradeModal && (
          <UpgradeModal
            onClose={() => setShowUpgradeModal(false)}
            feature={upgradeFeature}
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
  const [step, setStep] = useState<'platform' | 'username' | 'leagues' | 'manual'>('platform');
  const [username, setUsername] = useState('');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isSuperflex, setIsSuperflex] = useState(false);
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');

  const handlePlatformSelect = (selectedPlatform: 'sleeper' | 'espn' | 'yahoo' | 'nfl') => {
    setPlatform(selectedPlatform);
    if (selectedPlatform === 'sleeper') {
      setStep('username');
    } else {
      setStep('manual');
    }
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a Sleeper username');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userRes = await fetch(`https://api.sleeper.app/v1/user/${username.trim()}`);
      if (!userRes.ok) {
        setError('Sleeper user not found. Please check the username.');
        setLoading(false);
        return;
      }

      const userData = await userRes.json();
      const userId = userData.user_id;

      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${SEASON_CONTEXT.league_year}`);
      if (!leaguesRes.ok) {
        setError('Failed to fetch leagues');
        setLoading(false);
        return;
      }

      const leaguesData = await leaguesRes.json();
      setLeagues(leaguesData);
      setStep('leagues');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leagues');
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelect = async (league: any) => {
    const isSuperflex = league.roster_positions?.filter((pos: string) => pos === 'SUPER_FLEX').length > 0;

    const userRoster = await fetch(`https://api.sleeper.app/v1/league/${league.league_id}/users`)
      .then(res => res.json())
      .then(users => users.find((u: any) => u.display_name?.toLowerCase() === username.toLowerCase() || u.username?.toLowerCase() === username.toLowerCase()));

    const teamName = userRoster?.metadata?.team_name || userRoster?.display_name || username;

    onAdd(league.league_id, league.name, teamName, isSuperflex, 'sleeper');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-fdp-text-1">Add New League</h3>
          <button onClick={onClose} className="text-fdp-text-3 hover:text-fdp-text-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {step === 'platform' && (
          <div className="space-y-4">
            <p className="text-fdp-text-2 mb-4">Choose your fantasy platform:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePlatformSelect('sleeper')}
                className="p-6 border-2 border-fdp-border-1 rounded-lg hover:border-fdp-accent-1 hover:bg-fdp-surface-2 transition-all"
              >
                <div className="text-4xl mb-2">🛌</div>
                <div className="font-bold text-fdp-text-1">Sleeper</div>
                <div className="text-xs text-fdp-text-3 mt-1">Find by username</div>
              </button>
              <button
                onClick={() => handlePlatformSelect('espn')}
                className="p-6 border-2 border-fdp-border-1 rounded-lg hover:border-fdp-accent-1 hover:bg-fdp-surface-2 transition-all"
              >
                <div className="text-4xl mb-2">🏈</div>
                <div className="font-bold text-fdp-text-1">ESPN</div>
                <div className="text-xs text-fdp-text-3 mt-1">Manual setup</div>
              </button>
              <button
                disabled
                className="p-6 border-2 border-fdp-border-1 rounded-lg opacity-50 cursor-not-allowed"
              >
                <div className="text-4xl mb-2">🟣</div>
                <div className="font-bold text-fdp-text-1">Yahoo</div>
                <div className="text-xs text-fdp-text-3 mt-1">Coming soon</div>
              </button>
              <button
                disabled
                className="p-6 border-2 border-fdp-border-1 rounded-lg opacity-50 cursor-not-allowed"
              >
                <div className="text-4xl mb-2">🏆</div>
                <div className="font-bold text-fdp-text-1">NFL.com</div>
                <div className="text-xs text-fdp-text-3 mt-1">Coming soon</div>
              </button>
            </div>
          </div>
        )}

        {step === 'username' && (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-fdp-surface-2 rounded-full mb-3">
                <Search className="w-8 h-8 text-fdp-accent-1" />
              </div>
              <h4 className="text-lg font-semibold text-fdp-text-1 mb-2">Find Your Sleeper Leagues</h4>
              <p className="text-sm text-fdp-text-3">Enter your Sleeper username to view all your leagues</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-fdp-text-2 mb-2">
                Sleeper Username
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fdp-text-3 w-5 h-5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your Sleeper username"
                  className="w-full pl-10 pr-4 py-3 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
                  disabled={loading}
                />
              </div>
              <p className="mt-2 text-xs text-fdp-text-3">
                Your Sleeper username (not email). No authentication required.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-3 px-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Find My Leagues
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep('platform')}
                className="px-4 py-2 bg-fdp-surface-2 hover:bg-fdp-border-1 text-fdp-text-1 rounded-lg transition-all"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {step === 'leagues' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-fdp-text-1">Select a League</h4>
                <p className="text-sm text-fdp-text-3">Found {leagues.length} league(s) for {username}</p>
              </div>
              <button
                onClick={() => {
                  setStep('username');
                  setLeagues([]);
                  setError(null);
                }}
                className="text-sm text-fdp-accent-1 hover:underline"
              >
                Change Username
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {leagues.map((league) => (
                <button
                  key={league.league_id}
                  onClick={() => handleLeagueSelect(league)}
                  className="w-full p-4 border border-fdp-border-1 rounded-lg hover:border-fdp-accent-1 hover:bg-fdp-surface-2 transition-all text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-semibold text-fdp-text-1">{league.name}</h5>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className="text-xs px-2 py-1 bg-fdp-surface-2 text-fdp-text-3 rounded-full">
                          {league.total_rosters} Teams
                        </span>
                        <span className="text-xs px-2 py-1 bg-fdp-surface-2 text-fdp-text-3 rounded-full">
                          {league.season}
                        </span>
                        {league.roster_positions?.includes('SUPER_FLEX') && (
                          <span className="text-xs px-2 py-1 bg-fdp-accent-1 bg-opacity-20 text-fdp-accent-2 rounded-full">
                            Superflex
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 bg-fdp-surface-2 text-fdp-text-3 rounded-full capitalize">
                          {league.status}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-fdp-text-3 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="p-3 bg-fdp-surface-2 rounded-lg mb-4">
              <p className="text-sm text-fdp-text-2">
                {platform === 'espn' && 'ESPN leagues require authentication cookies. Follow the instructions below.'}
                {platform === 'yahoo' && 'Yahoo integration is coming soon.'}
                {platform === 'nfl' && 'NFL.com integration is coming soon.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-fdp-text-2 mb-1">
                League ID *
              </label>
              <input
                type="text"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
                placeholder="Enter league ID"
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
                placeholder="My League"
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

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 text-fdp-bg-0 font-semibold py-2 px-4 rounded-lg hover:shadow-lg transition-all"
              >
                Add League
              </button>
              <button
                type="button"
                onClick={() => setStep('platform')}
                className="px-4 py-2 bg-fdp-surface-2 hover:bg-fdp-border-1 text-fdp-text-1 rounded-lg transition-all"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

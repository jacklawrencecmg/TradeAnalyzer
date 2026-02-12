import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, UserLeague } from '../lib/supabase';
import { LogOut, Plus, Settings, TrendingUp, Users, Trophy, Activity, History, Search, Shield, Clipboard, FileText, Swords, MessageCircle, Bell, Newspaper, Share2, ArrowLeftRight, ShoppingCart, RefreshCw, Calendar } from 'lucide-react';
import { LeagueManager } from './LeagueManager';
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

type TabType = 'trade' | 'rankings' | 'playoffs' | 'history' | 'waiver' | 'lineup' | 'trends' | 'championship' | 'tradeFinder' | 'tradeBlock' | 'counterOffer' | 'draft' | 'keeper' | 'health' | 'recap' | 'rivalry' | 'chat' | 'notifications' | 'news' | 'export';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const [leagues, setLeagues] = useState<UserLeague[]>([]);
  const [currentLeague, setCurrentLeague] = useState<UserLeague | null>(null);
  const [showAddLeague, setShowAddLeague] = useState(false);
  const [showManageLeagues, setShowManageLeagues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('trade');

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
    } finally {
      setLoading(false);
    }
  };

  const handleAddLeague = async (leagueId: string, leagueName: string, teamName: string, isSuperflex: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('user_leagues').insert({
        user_id: user.id,
        league_id: leagueId,
        league_name: leagueName || `League ${leagueId}`,
        team_name: teamName,
        is_superflex: isSuperflex,
        is_active: true,
      });

      if (error) throw error;

      await loadLeagues();
      setShowAddLeague(false);
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        alert('This league is already saved to your account.');
      } else {
        console.error('Error adding league:', error);
        alert('Failed to add league. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-fdp-bg-1 to-fdp-bg-0">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    <NavButton icon={Search} label="Waiver Assistant" shortLabel="Waiver" tab="waiver" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Users} label="Lineup Optimizer" shortLabel="Lineup" tab="lineup" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={TrendingUp} label="Value Trends" shortLabel="Trends" tab="trends" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Trophy} label="Championship Odds" shortLabel="Champion" tab="championship" activeTab={activeTab} onClick={setActiveTab} />
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
                  <h3 className="text-sm font-semibold text-fdp-text-3 mb-3">News & Sharing</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <NavButton icon={Newspaper} label="Player News" shortLabel="News" tab="news" activeTab={activeTab} onClick={setActiveTab} />
                    <NavButton icon={Share2} label="Export & Share" shortLabel="Share" tab="export" activeTab={activeTab} onClick={setActiveTab} />
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === 'trade' && <TradeAnalyzer leagueId={currentLeague.league_id} onTradeSaved={() => setActiveTab('history')} />}
              {activeTab === 'rankings' && <PowerRankings leagueId={currentLeague.league_id} />}
              {activeTab === 'playoffs' && <PlayoffSimulator leagueId={currentLeague.league_id} />}
              {activeTab === 'history' && <TradeHistory leagueId={currentLeague.league_id} />}
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
            </div>
          </div>
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
  onAdd: (leagueId: string, leagueName: string, teamName: string, isSuperflex: boolean) => void;
}

function AddLeagueModal({ onClose, onAdd }: AddLeagueModalProps) {
  const [leagueId, setLeagueId] = useState('');
  const [leagueName, setLeagueName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isSuperflex, setIsSuperflex] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leagueId.trim()) {
      alert('Please enter a League ID');
      return;
    }
    onAdd(leagueId.trim(), leagueName.trim(), teamName.trim(), isSuperflex);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-fdp-surface-1 border border-fdp-border-1 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-fdp-text-1 mb-4">Add New League</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fdp-text-2 mb-1">
              Sleeper League ID *
            </label>
            <input
              type="text"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="w-full px-4 py-2 bg-fdp-surface-2 border border-fdp-border-1 text-fdp-text-1 rounded-lg focus:ring-2 focus:ring-fdp-accent-1 focus:border-transparent outline-none"
              placeholder="e.g., 123456789"
              required
            />
          </div>

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

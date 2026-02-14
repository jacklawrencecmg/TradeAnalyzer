import { useEffect, useState } from 'react';
import { Calendar, TrendingUp, ArrowRight, Activity } from 'lucide-react';
import { getPlayerTransactions, getPlayerTeamHistory, TransactionRecord, TeamHistoryRecord } from '../lib/players/getPlayerTeamAtDate';

interface PlayerCareerTimelineProps {
  playerId: string;
}

const TRANSACTION_ICONS: Record<string, any> = {
  team_changed: ArrowRight,
  signed: TrendingUp,
  released: Activity,
  traded: ArrowRight,
  practice_squad: Activity,
  activated: TrendingUp,
  injured_reserve: Activity,
  waived: Activity,
  claimed: TrendingUp,
};

const TRANSACTION_COLORS: Record<string, string> = {
  team_changed: 'text-blue-600',
  signed: 'text-green-600',
  released: 'text-red-600',
  traded: 'text-purple-600',
  practice_squad: 'text-yellow-600',
  activated: 'text-green-600',
  injured_reserve: 'text-orange-600',
  waived: 'text-red-600',
  claimed: 'text-green-600',
};

function formatTransactionText(transaction: TransactionRecord): string {
  switch (transaction.transaction_type) {
    case 'team_changed':
      if (transaction.team_from && transaction.team_to) {
        return `Moved from ${transaction.team_from} to ${transaction.team_to}`;
      }
      return transaction.team_to ? `Joined ${transaction.team_to}` : 'Team changed';
    case 'signed':
      return transaction.team_to ? `Signed with ${transaction.team_to}` : 'Signed';
    case 'released':
      return transaction.team_from ? `Released by ${transaction.team_from}` : 'Released';
    case 'traded':
      if (transaction.team_from && transaction.team_to) {
        return `Traded from ${transaction.team_from} to ${transaction.team_to}`;
      }
      return 'Traded';
    case 'practice_squad':
      return transaction.team_to ? `Added to ${transaction.team_to} practice squad` : 'Practice squad';
    case 'activated':
      return 'Activated from reserve';
    case 'injured_reserve':
      return 'Placed on injured reserve';
    case 'waived':
      return transaction.team_from ? `Waived by ${transaction.team_from}` : 'Waived';
    case 'claimed':
      return transaction.team_to ? `Claimed by ${transaction.team_to}` : 'Claimed off waivers';
    default:
      return transaction.transaction_type.replace(/_/g, ' ');
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${year}`;
}

export default function PlayerCareerTimeline({ playerId }: PlayerCareerTimelineProps) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [teamHistory, setTeamHistory] = useState<TeamHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCareerData();
  }, [playerId]);

  async function loadCareerData() {
    setLoading(true);
    try {
      const [txData, historyData] = await Promise.all([
        getPlayerTransactions(playerId),
        getPlayerTeamHistory(playerId),
      ]);
      setTransactions(txData);
      setTeamHistory(historyData);
    } catch (err) {
      console.error('Error loading career data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0 && teamHistory.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No career history available</p>
        <p className="text-sm text-gray-500 mt-1">
          Team changes and transactions will appear here
        </p>
      </div>
    );
  }

  const allEvents = [
    ...transactions.map(tx => ({
      type: 'transaction' as const,
      date: tx.transaction_date,
      data: tx,
    })),
    ...teamHistory.map(th => ({
      type: 'history' as const,
      date: th.from_date,
      data: th,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Career Timeline
      </h3>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-4">
          {allEvents.map((event, index) => {
            if (event.type === 'transaction') {
              const tx = event.data as TransactionRecord;
              const Icon = TRANSACTION_ICONS[tx.transaction_type] || Activity;
              const color = TRANSACTION_COLORS[tx.transaction_type] || 'text-gray-600';

              return (
                <div key={`tx-${tx.id}-${index}`} className="relative pl-16 pr-4">
                  <div className={`absolute left-6 w-4 h-4 rounded-full bg-white border-2 border-current ${color} z-10`}>
                    <Icon className="w-2.5 h-2.5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {formatTransactionText(tx)}
                        </p>
                        {tx.metadata && Object.keys(tx.metadata).length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            {tx.metadata.details || ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Source: {tx.source}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(tx.transaction_date)}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {tx.transaction_type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            } else {
              const history = event.data as TeamHistoryRecord;
              if (history.is_current) return null;

              return (
                <div key={`hist-${history.id}-${index}`} className="relative pl-16 pr-4">
                  <div className="absolute left-6 w-4 h-4 rounded-full bg-white border-2 border-gray-400 z-10"></div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-700">
                          Team: {history.team}
                        </p>
                        {history.to_date && (
                          <p className="text-sm text-gray-600 mt-1">
                            Ended: {formatDate(history.to_date)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(history.from_date)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {history.source}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>

      {teamHistory.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Team History Summary</h4>
          <div className="flex flex-wrap gap-2">
            {teamHistory.slice(0, 5).map((th, index) => (
              <div
                key={th.id}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  th.is_current
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {th.team}
                {th.is_current && ' (Current)'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, X } from 'lucide-react';
import { useVisitorTracking } from '../hooks/useVisitorTracking';
import { supabase } from '../lib/supabase';

interface ValueChange {
  player_name: string;
  old_value: number;
  new_value: number;
  change_percent: number;
}

export function ReturningVisitorBanner() {
  const { isReturningVisitor, visitCount, loading } = useVisitorTracking();
  const [dismissed, setDismissed] = useState(false);
  const [valueChanges, setValueChanges] = useState<ValueChange[]>([]);

  useEffect(() => {
    if (!isReturningVisitor || loading) return;

    const dismissedKey = 'fdp_returning_visitor_dismissed';
    const lastDismissed = localStorage.getItem(dismissedKey);

    if (lastDismissed) {
      const dismissedDate = new Date(lastDismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceDismissed < 7) {
        setDismissed(true);
        return;
      }
    }

    loadRecentValueChanges();
  }, [isReturningVisitor, loading]);

  async function loadRecentValueChanges() {
    try {
      const { data } = await supabase
        .from('player_value_trends')
        .select(`
          player_id,
          change_amount,
          change_percent,
          created_at
        `)
        .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('change_percent', { ascending: false })
        .limit(3);

      if (data && data.length > 0) {
        const playerIds = data.map(d => d.player_id);

        const { data: players } = await supabase
          .rpc('get_latest_player_values', {})
          .in('player_id', playerIds);

        if (players) {
          const changes: ValueChange[] = data.map(trend => {
            const player = players.find((p: any) => p.player_id === trend.player_id);
            if (!player) return null;

            return {
              player_name: player.full_name,
              old_value: player.base_value - trend.change_amount,
              new_value: player.base_value,
              change_percent: trend.change_percent
            };
          }).filter(Boolean) as ValueChange[];

          setValueChanges(changes);
        }
      }
    } catch (error) {
      console.error('Failed to load value changes:', error);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('fdp_returning_visitor_dismissed', new Date().toISOString());
  }

  if (!isReturningVisitor || dismissed || loading) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6 mb-6 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-fdp-text-3 hover:text-fdp-text-1 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1">
          <h3 className="text-xl font-bold text-fdp-text-1 mb-1">
            Welcome back! 👋
          </h3>
          <p className="text-fdp-text-3 text-sm mb-4">
            This is visit #{visitCount}. Values have been updated since you were last here.
          </p>

          {valueChanges.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-fdp-text-2 mb-2">
                Top value changes in the last 24 hours:
              </div>

              {valueChanges.map((change, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-fdp-surface-2 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      change.change_percent > 0
                        ? 'bg-green-500/20'
                        : 'bg-red-500/20'
                    }`}>
                      {change.change_percent > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-fdp-text-1">
                        {change.player_name}
                      </div>
                      <div className="text-xs text-fdp-text-3">
                        {Math.round(change.old_value)} → {Math.round(change.new_value)}
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold ${
                    change.change_percent > 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}>
                    {change.change_percent > 0 ? '+' : ''}{change.change_percent.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-fdp-border-1">
            <p className="text-xs text-fdp-text-3">
              💡 <span className="font-semibold">Pro tip:</span> Sign up to get alerts when your tracked players change value
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

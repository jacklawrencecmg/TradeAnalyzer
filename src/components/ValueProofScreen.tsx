import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign, Zap, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getValueProof, ValueProof, createCheckoutSession } from '../lib/subscription';

export function ValueProofScreen() {
  const { user } = useAuth();
  const [proof, setProof] = useState<ValueProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (user) {
      loadProof();
    }
  }, [user]);

  async function loadProof() {
    if (!user) return;

    setLoading(true);
    try {
      const data = await getValueProof(user.id);
      setProof(data);
    } catch (error) {
      console.error('Failed to load value proof:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade() {
    setRedirecting(true);

    const url = await createCheckoutSession(
      window.location.origin + '/dashboard?upgraded=true',
      window.location.origin + '/premium'
    );

    if (url) {
      window.location.href = url;
    } else {
      alert('Failed to create checkout session. Please try again.');
      setRedirecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-fdp-text-3">Loading your opportunities...</div>
      </div>
    );
  }

  const hasData = proof && proof.missed_opportunities_count > 0;
  const avgDelay = proof?.avg_hours_delayed || 0;
  const totalValue = proof?.total_value_change || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-fdp-text-1 mb-4">
          See What You're Missing
        </h1>
        <p className="text-lg text-fdp-text-3">
          Premium users get early alerts and competitive advantages
        </p>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-500" />
                </div>
                <div className="text-3xl font-bold text-fdp-text-1">
                  {proof.missed_opportunities_count}
                </div>
              </div>
              <div className="text-sm font-semibold text-fdp-text-2">
                Missed Opportunities
              </div>
              <div className="text-xs text-fdp-text-3 mt-1">
                Last 30 days
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-500" />
                </div>
                <div className="text-3xl font-bold text-fdp-text-1">
                  {avgDelay.toFixed(1)}h
                </div>
              </div>
              <div className="text-sm font-semibold text-fdp-text-2">
                Average Delay
              </div>
              <div className="text-xs text-fdp-text-3 mt-1">
                Premium users notified earlier
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
                <div className="text-3xl font-bold text-fdp-text-1">
                  {totalValue.toLocaleString()}
                </div>
              </div>
              <div className="text-sm font-semibold text-fdp-text-2">
                Total Value Change
              </div>
              <div className="text-xs text-fdp-text-3 mt-1">
                Could have captured
              </div>
            </div>
          </div>

          <div className="bg-fdp-surface-1 rounded-xl p-6 border border-fdp-border-1">
            <h3 className="text-lg font-bold text-fdp-text-1 mb-4">
              Recent Missed Opportunities
            </h3>

            <div className="space-y-4">
              {proof.top_opportunities?.slice(0, 5).map((opp, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 bg-fdp-surface-2 rounded-lg border border-fdp-border-1"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    opp.value_change > 0
                      ? 'bg-green-500/20'
                      : 'bg-red-500/20'
                  }`}>
                    {opp.value_change > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold text-fdp-text-1 mb-1">
                      {opp.player_id}
                    </div>
                    <div className="text-sm text-fdp-text-3 mb-2">
                      {opp.free_user_could_have_saved}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-fdp-text-3">
                        Value: {opp.value_before} → {opp.value_after}
                      </span>
                      <span className={`font-bold ${
                        opp.value_change > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {opp.value_change > 0 ? '+' : ''}{opp.value_change}
                      </span>
                      <span className="text-fdp-text-3">
                        {new Date(opp.detected_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-fdp-surface-1 rounded-xl p-12 border border-fdp-border-1 text-center">
          <div className="w-16 h-16 bg-fdp-accent-1/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-fdp-accent-1" />
          </div>
          <h3 className="text-xl font-bold text-fdp-text-1 mb-2">
            Start Tracking Today
          </h3>
          <p className="text-fdp-text-3 mb-6">
            We'll start tracking missed opportunities once you upgrade to Premium
          </p>
        </div>
      )}

      <div className="bg-gradient-to-r from-fdp-accent-1 to-fdp-accent-2 rounded-2xl p-8 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Never Miss Another Opportunity
          </h2>
          <p className="text-lg text-white/90 mb-6">
            Premium members get instant alerts, trade monitoring, and competitive advantages
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
            {[
              'Real-time value change alerts',
              'Early access to market trends',
              'Automatic trade monitoring',
              'Unlimited saved trades',
              'Weekly strategy reports',
              'Priority support',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={redirecting}
            className="bg-white text-fdp-accent-1 font-bold py-4 px-8 rounded-xl hover:bg-gray-100 transition-all inline-flex items-center gap-2 group disabled:opacity-50"
          >
            {redirecting ? (
              'Redirecting...'
            ) : (
              <>
                Upgrade to Premium
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <p className="text-white/60 text-sm mt-4">
            Cancel anytime • 30-day money-back guarantee
          </p>
        </div>
      </div>

      {hasData && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-fdp-text-1 mb-2">
                The Cost of Waiting
              </h3>
              <p className="text-sm text-fdp-text-3">
                In the last 30 days, you missed {proof.missed_opportunities_count} opportunities
                worth {totalValue.toLocaleString()} in total value change. Premium users were
                notified an average of {avgDelay.toFixed(1)} hours earlier. How much is early
                information worth to your dynasty team?
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { cancelSubscription, reactivateSubscription } from '../lib/subscription';
import ConfirmDialog from './ConfirmDialog';

export function SubscriptionManagement() {
  const { subscription, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!subscription || !subscription.is_pro) {
    return null;
  }

  const handleCancel = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await cancelSubscription();
      setSuccess(result.message);
      setShowCancelDialog(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await reactivateSubscription();
      setSuccess(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setLoading(false);
    }
  };

  const periodEnd = subscription.period_end
    ? new Date(subscription.period_end).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="bg-fdp-surface-1 rounded-xl border border-fdp-border-1 p-6">
      <h3 className="text-xl font-bold text-fdp-text-1 mb-4">Subscription Management</h3>

      {error && (
        <div className="mb-4 bg-fdp-neg bg-opacity-10 border border-fdp-neg text-fdp-neg px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-fdp-pos bg-opacity-10 border border-fdp-pos text-fdp-pos px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-fdp-text-3">Current Plan</p>
            <p className="text-lg font-bold text-fdp-text-1">
              {subscription.is_trial ? 'Pro (Trial)' : 'Pro'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-fdp-text-3">Status</p>
            <p className="text-lg font-semibold text-fdp-text-1 capitalize">
              {subscription.status}
            </p>
          </div>
        </div>

        {periodEnd && (
          <div className="flex items-center gap-2 text-sm text-fdp-text-3">
            <Calendar className="w-4 h-4" />
            <span>
              {subscription.cancel_at_period_end
                ? `Access until ${periodEnd}`
                : `Renews on ${periodEnd}`}
            </span>
          </div>
        )}

        {subscription.cancel_at_period_end ? (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-orange-900 mb-1">
                  Subscription Scheduled for Cancellation
                </h4>
                <p className="text-sm text-orange-800 mb-3">
                  Your Pro subscription will end on {periodEnd}. You'll keep access until then.
                </p>
                <button
                  onClick={handleReactivate}
                  disabled={loading}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Processing...' : 'Reactivate Subscription'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-fdp-border-1">
            <button
              onClick={() => setShowCancelDialog(true)}
              disabled={loading}
              className="text-fdp-text-3 hover:text-fdp-neg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Subscription
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="Cancel Subscription?"
        message="Are you sure you want to cancel your Pro subscription? You'll keep access until the end of your current billing period, and you can reactivate anytime before then."
        confirmText="Yes, Cancel Subscription"
        cancelText="Keep Subscription"
        type="danger"
      />
    </div>
  );
}

import { useState } from 'react';
import { X, AlertCircle, Bug, HelpCircle, Lightbulb, ThumbsDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { env } from '../lib/env';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: {
    page?: string;
    playerId?: string;
    playerName?: string;
    tradeDetails?: any;
    leagueId?: string;
    valueEpoch?: string;
  };
}

export function FeedbackModal({ isOpen, onClose, context }: FeedbackModalProps) {
  const { user } = useAuth();
  const [type, setType] = useState<'bug' | 'wrong_value' | 'confusing' | 'feature' | 'other'>('bug');
  const [goal, setGoal] = useState('');
  const [issue, setIssue] = useState('');
  const [valueWrong, setValueWrong] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const metadata = {
        goal,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        valueWrong,
        ...context,
      };

      const { error } = await supabase.from('user_feedback').insert({
        user_id: user?.id || null,
        league_id: context?.leagueId || null,
        page: context?.page || window.location.pathname,
        type,
        message: issue,
        metadata,
        status: 'open',
      });

      if (error) throw error;

      fetch(`${env.supabaseUrl}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          type: 'feedback',
          feedbackType: type,
          goal,
          issue,
          page: context?.page || window.location.pathname,
          url: window.location.href,
          userEmail: user?.email,
          playerName: context?.playerName,
          valueWrong,
          leagueId: context?.leagueId,
          timestamp: new Date().toISOString(),
        }),
      }).catch(err => console.error('Failed to send feedback email:', err));

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setGoal('');
        setIssue('');
        setValueWrong(false);
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const types = [
    { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-500' },
    { value: 'wrong_value', label: 'Wrong Value', icon: AlertCircle, color: 'text-orange-500' },
    { value: 'confusing', label: 'Confusing', icon: HelpCircle, color: 'text-yellow-500' },
    { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-blue-500' },
    { value: 'other', label: 'Other', icon: ThumbsDown, color: 'text-gray-500' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Give Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900">Thank you!</p>
              <p className="text-sm text-gray-600 mt-2">Your feedback helps us improve.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  What type of feedback?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {types.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value as any)}
                        className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                          type === t.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${type === t.value ? 'text-blue-600' : t.color}`} />
                        <span className="text-sm font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What were you trying to do?
                </label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Check Bijan Robinson's value"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What went wrong or what would you like?
                </label>
                <textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Describe the issue or your suggestion..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                />
              </div>

              {context?.playerName && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={valueWrong}
                      onChange={(e) => setValueWrong(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      This value looks wrong for {context.playerName}
                    </span>
                  </label>
                  {valueWrong && (
                    <p className="text-xs text-gray-600 mt-2">
                      We'll automatically attach the player and current value for investigation.
                    </p>
                  )}
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  <strong>Auto-attached:</strong> Page location, timestamp, league context
                  {context?.playerName && ', player details'}
                  {context?.tradeDetails && ', trade details'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

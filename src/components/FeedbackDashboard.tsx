import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bug, AlertCircle, HelpCircle, Lightbulb, ThumbsDown, Check, X, Clock } from 'lucide-react';

interface Feedback {
  id: string;
  user_id: string | null;
  page: string;
  type: string;
  message: string;
  metadata: any;
  created_at: string;
  status: string;
  admin_notes: string | null;
}

export function FeedbackDashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'bug' | 'wrong_value'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadFeedback();
  }, [filter]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'open') {
        query = query.eq('status', 'open');
      } else if (filter === 'bug') {
        query = query.eq('type', 'bug');
      } else if (filter === 'wrong_value') {
        query = query.eq('type', 'wrong_value');
      }

      const { data, error } = await query;
      if (error) throw error;

      setFeedback(data || []);
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({ status, admin_notes: adminNotes })
        .eq('id', id);

      if (error) throw error;

      await loadFeedback();
      setSelectedFeedback(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Failed to update feedback');
    } finally {
      setUpdating(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'bug': return <Bug className="w-5 h-5 text-red-500" />;
      case 'wrong_value': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'confusing': return <HelpCircle className="w-5 h-5 text-yellow-500" />;
      case 'feature': return <Lightbulb className="w-5 h-5 text-blue-500" />;
      default: return <ThumbsDown className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      fixed: 'bg-green-100 text-green-800',
      wont_fix: 'bg-gray-100 text-gray-800',
      duplicate: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status as keyof typeof styles]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const stats = {
    total: feedback.length,
    open: feedback.filter(f => f.status === 'open').length,
    bugs: feedback.filter(f => f.type === 'bug').length,
    wrongValues: feedback.filter(f => f.type === 'wrong_value').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback Dashboard</h1>
        <p className="text-gray-600">Review and manage user feedback</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Open</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Bugs</div>
          <div className="text-2xl font-bold text-red-600">{stats.bugs}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Wrong Values</div>
          <div className="text-2xl font-bold text-orange-600">{stats.wrongValues}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            {['all', 'open', 'bug', 'wrong_value'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f === 'wrong_value' ? 'Wrong Values' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading feedback...</div>
        ) : feedback.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No feedback found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {feedback.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedFeedback(item)}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getIcon(item.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{item.type.replace('_', ' ')}</span>
                      {getStatusBadge(item.status)}
                      <span className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">{item.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Page: {item.page}</span>
                      {item.metadata?.playerName && <span>Player: {item.metadata.playerName}</span>}
                      {item.metadata?.valueWrong && (
                        <span className="text-orange-600 font-medium">Value flagged</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFeedback && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Feedback Details</h2>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <div className="flex items-center gap-2">
                    {getIcon(selectedFeedback.type)}
                    <span className="text-gray-900">{selectedFeedback.type.replace('_', ' ')}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {getStatusBadge(selectedFeedback.status)}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedFeedback.message}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Context</label>
                  <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                    <div><strong>Page:</strong> {selectedFeedback.page}</div>
                    <div><strong>Date:</strong> {new Date(selectedFeedback.created_at).toLocaleString()}</div>
                    {selectedFeedback.metadata?.goal && (
                      <div><strong>Goal:</strong> {selectedFeedback.metadata.goal}</div>
                    )}
                    {selectedFeedback.metadata?.playerName && (
                      <div><strong>Player:</strong> {selectedFeedback.metadata.playerName}</div>
                    )}
                    {selectedFeedback.metadata?.valueWrong && (
                      <div className="text-orange-600 font-medium">Value marked as incorrect</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this feedback..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(selectedFeedback.id, 'fixed')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Mark Fixed
                  </button>
                  <button
                    onClick={() => updateStatus(selectedFeedback.id, 'in_progress')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-4 h-4" />
                    In Progress
                  </button>
                  <button
                    onClick={() => updateStatus(selectedFeedback.id, 'wont_fix')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Won't Fix
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface QuickReactionProps {
  contentType: 'trade' | 'advice' | 'ranking' | 'value';
  contentId?: string;
  metadata?: any;
  className?: string;
}

export function QuickReaction({ contentType, contentId, metadata, className = '' }: QuickReactionProps) {
  const { user } = useAuth();
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleReaction = async (type: 'up' | 'down') => {
    if (submitting || reaction) return;

    setSubmitting(true);
    setReaction(type);

    try {
      const feedbackMetadata = {
        contentType,
        contentId,
        reaction: type,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        ...metadata,
      };

      const { error } = await supabase.from('user_feedback').insert({
        user_id: user?.id || null,
        page: window.location.pathname,
        type: 'reaction',
        message: `${type === 'up' ? 'Helpful' : 'Not helpful'}: ${contentType}`,
        metadata: feedbackMetadata,
        status: 'open',
      });

      if (error) throw error;

      setTimeout(() => {
        setReaction(null);
      }, 3000);
    } catch (error) {
      console.error('Error submitting reaction:', error);
      setReaction(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-500 mr-1">Helpful?</span>
      <button
        onClick={() => handleReaction('up')}
        disabled={submitting || reaction !== null}
        className={`p-1.5 rounded transition-all ${
          reaction === 'up'
            ? 'bg-green-100 text-green-600'
            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Helpful"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleReaction('down')}
        disabled={submitting || reaction !== null}
        className={`p-1.5 rounded transition-all ${
          reaction === 'down'
            ? 'bg-red-100 text-red-600'
            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Not helpful"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
      {reaction && (
        <span className="text-xs text-gray-600 animate-fade-in">
          Thanks!
        </span>
      )}
    </div>
  );
}

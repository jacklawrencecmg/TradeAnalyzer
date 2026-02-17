import { useEffect, useState, useCallback } from 'react';
import { initializeSession, trackEvent, getSessionIntent, getSessionId } from '../lib/session/getSessionId';

interface VisitorIntent {
  score: number;
  level: 'low' | 'medium' | 'high';
  visitCount: number;
}

export function useVisitorTracking() {
  const [sessionId, setSessionId] = useState<string>('');
  const [intent, setIntent] = useState<VisitorIntent>({
    score: 0,
    level: 'low',
    visitCount: 1
  });
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initTracking() {
      try {
        const id = await initializeSession();
        setSessionId(id);

        const intentData = await getSessionIntent(id);
        setIntent(intentData);
        setIsReturningVisitor(intentData.visitCount > 1);
      } catch (error) {
        console.error('Failed to initialize tracking:', error);
        setSessionId(getSessionId());
      } finally {
        setLoading(false);
      }
    }

    initTracking();
  }, []);

  const track = useCallback(async (eventType: string, metadata: Record<string, any> = {}) => {
    if (!sessionId) return;

    await trackEvent(sessionId, eventType, metadata);

    const updatedIntent = await getSessionIntent(sessionId);
    setIntent(updatedIntent);
  }, [sessionId]);

  return {
    sessionId,
    intent,
    isReturningVisitor,
    loading,
    track
  };
}

export function useEventTracking(eventType: string, metadata?: Record<string, any>) {
  const { track } = useVisitorTracking();

  useEffect(() => {
    track(eventType, metadata || {});
  }, []);
}

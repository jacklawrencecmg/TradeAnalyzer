import { supabase } from '../supabase';

const SESSION_KEY = 'fdp_session_id';
const FINGERPRINT_KEY = 'fdp_fingerprint';

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function hasSession(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!localStorage.getItem(SESSION_KEY);
}

export async function initializeSession(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  let sessionId = localStorage.getItem(SESSION_KEY);

  if (sessionId) {
    await updateLastSeen(sessionId);
    return sessionId;
  }

  const fingerprint = await generateFingerprint();
  sessionId = await createOrRetrieveSession(fingerprint);

  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(FINGERPRINT_KEY, fingerprint);

  return sessionId;
}

async function createOrRetrieveSession(fingerprint: string): Promise<string> {
  const { data: existingSessions } = await supabase
    .from('visitor_sessions')
    .select('session_id, visit_count')
    .eq('fingerprint', fingerprint)
    .order('last_seen', { ascending: false })
    .limit(1);

  if (existingSessions && existingSessions.length > 0) {
    const session = existingSessions[0];

    await supabase
      .from('visitor_sessions')
      .update({
        last_seen: new Date().toISOString(),
        visit_count: session.visit_count + 1
      })
      .eq('session_id', session.session_id);

    await trackEvent(session.session_id, 'repeat_visit', {});

    return session.session_id;
  }

  const { data, error } = await supabase
    .from('visitor_sessions')
    .insert({
      fingerprint,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      visit_count: 1,
      intent_score: 0,
      intent_level: 'low'
    })
    .select('session_id')
    .single();

  if (error || !data) {
    console.error('Failed to create session:', error);
    return crypto.randomUUID();
  }

  return data.session_id;
}

async function updateLastSeen(sessionId: string): Promise<void> {
  await supabase
    .from('visitor_sessions')
    .update({ last_seen: new Date().toISOString() })
    .eq('session_id', sessionId);
}

async function generateFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width,
    screen.height,
    screen.colorDepth
  ];

  const fingerprint = components.join('|');
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function trackEvent(
  sessionId: string,
  eventType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.rpc('track_visitor_event', {
      p_session_id: sessionId,
      p_event_type: eventType,
      p_metadata: metadata
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export async function getSessionIntent(sessionId: string): Promise<{
  score: number;
  level: 'low' | 'medium' | 'high';
  visitCount: number;
}> {
  const { data } = await supabase
    .from('visitor_sessions')
    .select('intent_score, intent_level, visit_count')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (!data) {
    return { score: 0, level: 'low', visitCount: 1 };
  }

  return {
    score: data.intent_score,
    level: data.intent_level as 'low' | 'medium' | 'high',
    visitCount: data.visit_count
  };
}

export async function markConversion(sessionId: string): Promise<void> {
  await supabase
    .from('visitor_sessions')
    .update({
      converted: true,
      converted_at: new Date().toISOString()
    })
    .eq('session_id', sessionId);
}

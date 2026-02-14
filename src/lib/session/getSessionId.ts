const SESSION_KEY = 'fdp_session_id';

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

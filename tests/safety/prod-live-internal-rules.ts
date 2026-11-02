/*
  Which writes the internal Production Live suite may send (TC Live v1).
  Pure - unit-tested in ./environment-guard.unit.ts. Used by
  tests/fixtures/prod-live-internal.ts for browser requests AND for the
  `request` fixture, so neither path can reach anything else.

  Allowed: sign in / out, and the Live control routes of THE one internal
  test session (E2E_PROD_LIVE_SESSION_ID). Never DELETE, never another
  session, never registration, messaging, profile, admin or upload routes.
*/

const ID = '[A-Za-z0-9-]{1,64}';

export function allowedLiveWrite(method: string, pathname: string, sessionId: string): boolean {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
  if (m !== 'POST') return false;
  if (pathname === '/api/auth/login' || pathname === '/api/auth/logout') return true;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
  const base = `/api/organizer/sessions/${sessionId}`;
  const allowed = [
    new RegExp(`^${base}/checkin/${ID}$`),
    new RegExp(`^${base}/go-live$`),
    new RegExp(`^${base}/rounds/generate$`),
    new RegExp(`^${base}/matches/${ID}/(start|score)$`),
    new RegExp(`^${base}/registrations/${ID}/live-status$`),
    new RegExp(`^${base}/finish$`),
  ];
  return allowed.some((re) => re.test(pathname));
}

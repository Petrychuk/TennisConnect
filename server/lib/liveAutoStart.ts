/*
  TC Live automatic start (TC-189, PO decision 10 Nov 2026).

  A published session that runs in TC Live turns live by itself at its
  scheduled start time - no Start Live click needed. Rule:
  shared/sessionLifecycle.ts isDueToGoLive; the stored change is
  storage.autoStartDueSessions (one conditional UPDATE, so exactly once even
  with several server instances or a concurrent manual start).

  Two triggers, both safe to run any number of times:
    - a sweep every minute (startLiveAutoStartJob), so sessions turn live on
      time even when nobody has the Hub open;
    - on demand (autoStartIfDue) when the organiser opens or acts on their
      session, so they never see a stale "published" between sweeps.

  Respects the TC_LIVE_ENABLED switch: off -> nothing starts (the session
  stays published and shows Ready to Start); internal -> only internal test
  sessions. Finishing is never automatic.
*/
import { isDueToGoLive } from "@shared/sessionLifecycle";
import { liveAllowedFor, liveMode } from "./liveFeature";

type Env = Record<string, string | undefined>;

export interface AutoStartStore {
  autoStartDueSessions(opts: { now?: Date; internalOnly: boolean; sessionId?: string }): Promise<string[]>;
}

/** What the sweep may start in this environment, or null when Live is off. */
export function autoStartScope(env: Env = process.env): { internalOnly: boolean } | null {
  const mode = liveMode(env);
  if (mode === "off") return null;
  return { internalOnly: mode === "internal" };
}

/** One sweep. Returns the ids that turned live. */
export async function runLiveAutoStart(store: AutoStartStore, now = new Date(), env: Env = process.env): Promise<string[]> {
  const scope = autoStartScope(env);
  if (!scope) return [];
  const ids = await store.autoStartDueSessions({ now, internalOnly: scope.internalOnly });
  for (const id of ids) console.log(`[TC LIVE] session ${id}: went live automatically at its scheduled start`);
  return ids;
}

/**
 * The session as the organiser should see it now: turned live first if it
 * is due and Live is enabled for it. Mutates and returns `session`.
 */
export async function autoStartIfDue<T extends { id: string; status: string; startAt: Date | string; type?: string | null; isInternalTest?: boolean | null }>(
  store: AutoStartStore,
  session: T,
  now = new Date(),
  env: Env = process.env,
): Promise<T> {
  if (!isDueToGoLive(session, now) || !liveAllowedFor(session, env)) return session;
  const scope = autoStartScope(env);
  if (!scope) return session;
  const ids = await store.autoStartDueSessions({ now, internalOnly: scope.internalOnly, sessionId: session.id });
  if (ids.includes(session.id)) {
    console.log(`[TC LIVE] session ${session.id}: went live automatically at its scheduled start`);
    session.status = "live";
  }
  // Not changed here: another instance or the sweep got there first (it is
  // live now) or it isn't eligible (e.g. a container of divisions). Either
  // way the stored row is the truth; callers re-read when they need it.
  return session;
}

export const AUTO_START_INTERVAL_MS = 60_000;

/** Starts the minute sweep. Errors are logged, never thrown; the timer never keeps the process alive. */
export function startLiveAutoStartJob(store: AutoStartStore, intervalMs = AUTO_START_INTERVAL_MS): () => void {
  let running = false;
  const tick = async () => {
    if (running) return; // a slow sweep is never run twice at once
    running = true;
    try {
      await runLiveAutoStart(store);
    } catch (error) {
      console.error("[TC LIVE] automatic start sweep failed:", error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

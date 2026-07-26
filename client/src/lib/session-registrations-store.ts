import { useSyncExternalStore } from "react";
import { updateSession, getSessions } from "./organiser-sessions-store";

export type RegistrationStatus = "registered" | "waitlisted" | "cancelled";

export interface SessionRegistration {
  sessionId: string;
  status: RegistrationStatus;
  joinedAt: string; // ISO
}

const STORAGE_KEY = "tc-session-registrations-v1";

function loadInitial(): SessionRegistration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionRegistration[]) : [];
  } catch {
    return [];
  }
}

let registrations: SessionRegistration[] = loadInitial();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
  } catch {
    // Ignore storage errors - still works for the rest of this browser session.
  }
}

function notify() {
  listeners.forEach((l) => l());
}

export function getRegistrations(): SessionRegistration[] {
  return registrations;
}

export function subscribeToRegistrations(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRegistrationStatus(sessionId: string): RegistrationStatus | null {
  return registrations.find((r) => r.sessionId === sessionId && r.status !== "cancelled")?.status ?? null;
}

/**
 * Join a session. Goes to the waiting list automatically once the
 * session is at capacity (when a waiting list is enabled); otherwise
 * registers directly. Keeps the session's own registeredCount/
 * waitingCount in organiser-sessions-store in sync so every screen
 * reading that store (cards, Session Workspace, admin) reflects it too.
 */
export function joinSession(sessionId: string): RegistrationStatus {
  const session = getSessions().find((s) => s.id === sessionId);
  const isFull = session?.maxParticipants != null && session.registeredCount >= session.maxParticipants;
  const goesToWaitlist = isFull && !!session?.waitingListEnabled;
  const status: RegistrationStatus = goesToWaitlist ? "waitlisted" : "registered";

  registrations = [
    ...registrations.filter((r) => r.sessionId !== sessionId),
    { sessionId, status, joinedAt: new Date().toISOString() },
  ];
  persist();
  notify();

  if (session) {
    updateSession(sessionId, {
      registeredCount: status === "registered" ? session.registeredCount + 1 : session.registeredCount,
      waitingCount: status === "waitlisted" ? session.waitingCount + 1 : session.waitingCount,
    });
  }

  return status;
}

export function cancelRegistration(sessionId: string) {
  const existing = registrations.find((r) => r.sessionId === sessionId);
  registrations = registrations.map((r) => (r.sessionId === sessionId ? { ...r, status: "cancelled" as const } : r));
  persist();
  notify();

  const session = getSessions().find((s) => s.id === sessionId);
  if (session && existing) {
    updateSession(sessionId, {
      registeredCount: existing.status === "registered" ? Math.max(session.registeredCount - 1, 0) : session.registeredCount,
      waitingCount: existing.status === "waitlisted" ? Math.max(session.waitingCount - 1, 0) : session.waitingCount,
    });
  }
}

/** React hook - re-renders whenever the viewer's registrations change. */
export function useMyRegistrations(): SessionRegistration[] {
  return useSyncExternalStore(subscribeToRegistrations, getRegistrations, () => []);
}

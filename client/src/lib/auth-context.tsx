import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

// Plain fetch() has no timeout - if the server hangs (e.g. waiting on a
// database connection that never frees up), the promise never settles,
// so a caller stuck in a `loading` state stays stuck forever with no
// error, no toast, just a spinner that never stops. This aborts and
// throws a normal Error after a reasonable wait instead, so every
// caller's existing try/catch/finally handles it exactly like any
// other failed request.
const AUTH_FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "The server is taking too long to respond. Please try again in a moment."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

type UserRole = "player" | "coach" | null;

// Thrown by login() specifically for the "credentials were correct but
// the email isn't confirmed yet" case (HTTP 403, code
// EMAIL_NOT_VERIFIED from server/routes.ts) - a distinct type so
// callers like auth.tsx can show a "verify your email" screen with a
// resend action instead of the generic "Login failed" toast every
// other rejected login gets.
export class EmailNotVerifiedError extends Error {
  email: string;
  constructor(email: string) {
    super("Please confirm your email address before signing in.");
    this.name = "EmailNotVerifiedError";
    this.email = email;
  }
}

// What register() resolves with now that a fresh signup no longer
// creates a session (see server/routes.ts /api/auth/register) - there
// is no User to hand back yet, just confirmation that a verification
// email is on its way.
export interface RegistrationPending {
  email: string;
  requiresVerification: true;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  slug: string;
  avatar?: string | null;
  cover?: string | null;
  profileCompleted: boolean;
  isAdmin?: boolean;
  isOrganizer?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  profileLoaded: boolean;

  // Throws EmailNotVerifiedError (not the generic Error every other
  // rejected login throws) when the credentials are correct but the
  // account isn't verified yet.
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  // Never resolves with a User anymore - registering no longer creates
  // a session, it only ever kicks off the "check your email" step.
  register: (
    email: string,
    password: string,
    name: string,
    role: "player" | "coach",
    wantsToOrganize?: boolean
  ) => Promise<RegistrationPending>;

  // 🔹 Confirms a verification link's token; on success the server has
  // already created a session, so this resolves with the now-logged-in
  // user (same as login()/register() used to).
  verifyEmail: (token: string) => Promise<User>;

  // 🔹 Requests a fresh verification email. Always resolves with a
  // generic message - enumeration-safe by design, matches
  // forgot-password's own behaviour.
  resendVerificationEmail: (email: string) => Promise<{ message: string }>;

    // 🔹 GET current user 
    fetchCurrentUser: () => Promise<User | null>;

    // 🔹 PUT update user (avatar / cover / name)
    updateUserProfile: (updates: Partial<User>) => Promise<User | null>;
  
    // 🔹 локальное обновление (без API)
    updateUserLocal: (user: User) => void;

  logout: () => Promise<void>;

  // 🔹 clears local auth state without calling /api/auth/logout - for
  // when a background request (polling, etc.) discovers the session is
  // already gone server-side (401), so the UI stops presenting as
  // logged in and stops re-polling with a session that will never work.
  clearSession: () => void;

};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  /**
   * INIT AUTH ON APP LOAD
   */
  useEffect(() => {
      let cancelled = false;

      async function initAuth() {
        setLoading(true);

        try {
          const res = await fetch("/api/auth/me", {
            credentials: "include",
          });

          // /api/auth/me returns 200 for a logged-out guest too (see
          // server/routes.ts) - "nobody is signed in" is an expected
          // state here, not a failed request, so this isn't gated on
          // res.status like a real error would be. Only an actual
          // non-2xx (server error, network hiccup) falls through to the
          // !res.ok branch below.
          if (!res.ok) {
            console.error("Auth init failed:", res.status);
            if (!cancelled) {
              setUser(null);
              setProfileLoaded(false);
            }
            return;
          }

          const data = await res.json();

          // Authenticated responses are still the flat user object at
          // the top level (existing consumers like complete-profile.tsx
          // read fields straight off it) - only the logged-out shape is
          // `{ authenticated: false, user: null }`, so `data.user` is
          // never a real user to fall back to here.
          const resolvedUser: User | null = data?.authenticated ? data : null;

          if (!cancelled) {
            setUser(resolvedUser);
            setProfileLoaded(!!resolvedUser);
          }

        } catch (error) {
          console.error("Auth init network error", error);
          if (!cancelled) {
            setUser(null);
            setProfileLoaded(false);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      initAuth();

      return () => {
        cancelled = true;
      };
    }, []);

  /**
   * LOGIN
   */
  const login = async (email: string, password: string, rememberMe?: boolean): Promise<User> => {
    setLoading(true);

    try {
      const res = await fetchWithTimeout("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: !!rememberMe }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        if (res.status === 403 && error.code === "EMAIL_NOT_VERIFIED") {
          throw new EmailNotVerifiedError(error.email || email);
        }
        throw new Error(error.message || "Login failed");
      }

      const userData = await res.json();
      setUser(userData);
      if (!userData.slug) {
        console.warn("User logged in without slug");
      }
      setProfileLoaded(false);  // ожидаем загрузку профиля

      return userData;
    } finally {
      setLoading(false);
    }
  };

  /**
   * REGISTER
   *
   * No session is created here anymore - the account exists but stays
   * unverified until the emailed link is confirmed (see
   * server/routes.ts). Resolves with { email, requiresVerification }
   * instead of a User so callers show a "check your email" step rather
   * than treating the person as signed in.
   */
  const register = async (
    email: string,
    password: string,
    name: string,
    role: "player" | "coach",
    wantsToOrganize?: boolean
  ): Promise<RegistrationPending> => {
    setLoading(true);

    try {
      const res = await fetchWithTimeout("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role, wantsToOrganize }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Registration failed");
      }

      const data = await res.json();
      return { email: data.email ?? email, requiresVerification: true };
    } finally {
      setLoading(false);
    }
  };

  /**
   * VERIFY EMAIL
   *
   * Confirms a verification link's token. The server creates the
   * session as part of a successful verification (there was none to
   * create at register() time), so this is the point a freshly-signed-
   * up user actually becomes "logged in".
   */
  const verifyEmail = async (token: string): Promise<User> => {
    setLoading(true);

    try {
      const res = await fetchWithTimeout(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        { credentials: "include" }
      );

      const data = await res.json();

      if (!res.ok) {
        const err = new Error(data.message || "Verification failed");
        (err as any).status = data.status;
        throw err;
      }

      setUser(data.user);
      setProfileLoaded(false);

      // GA4 "sign_up" - fired here (confirmed email), not at
      // register() below, since that's the point a signup is real
      // rather than a bot/abandoned registration nobody ever
      // confirmed - the whole reason this flow gates on verification
      // at all. window.gtag may not exist yet (page just loaded) or at
      // all (skipped for automated browsers - see index.html), hence
      // the optional call rather than an assumed-present global.
      (window as any).gtag?.("event", "sign_up", { method: data.user.role });

      return data.user;
    } finally {
      setLoading(false);
    }
  };

  /**
   * RESEND VERIFICATION EMAIL
   */
  const resendVerificationEmail = async (email: string): Promise<{ message: string }> => {
    const res = await fetchWithTimeout("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to resend verification email");
    }

    return data;
  };
  const fetchCurrentUser = async () => {
    const res = await fetch("/api/auth/me", {
      credentials: "include",
    });
  
    if (!res.ok) {
      throw new Error("Failed to fetch user");
    }
  
    const data = await res.json();

    // Every existing caller of fetchCurrentUser() only ever calls it
    // when already authenticated (e.g. right after an avatar upload),
    // so data.authenticated === false here means the session died
    // underneath it - surface that as the same "no user" outcome the
    // 401-based version used to produce, rather than setting a fake
    // logged-in user out of the `{ authenticated: false, user: null }`
    // shape.
    if (!data?.authenticated) {
      setUser(null);
      return null;
    }

    setUser(data);
    return data;
  };

  // UPDATE USER (avatar / cover)
  const updateUserProfile = async (updates: Partial<User>) => {
    const res = await fetch("/api/auth/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
  
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
  
    const updatedUser = await res.json();
    setUser(updatedUser);
  
    return updatedUser;
  };
  
  // используется ТОЛЬКО после upload avatar / cover
  const updateUserLocal = (newUser: User) => {
    console.log("AUTH CONTEXT LOCAL UPDATE:", newUser);
    setUser(newUser);
  };

  // Called by background polling (unread-count, messages) when a
  // request comes back 401 - the session died server-side (dev-server
  // restarts wipe an in-memory session store, for example) but nothing
  // told the client. Unlike logout(), this doesn't hit the network -
  // there's nothing valid left server-side to log out of, and calling
  // /api/auth/logout here would just be one more request destined to
  // 401. Flips isAuthenticated to false, which is what actually stops
  // the polling (see its `enabled: isAuthenticated` / `if (!isAuthenticated) return`
  // guards) instead of it retrying every few seconds forever.
  const clearSession = () => {
    setUser(null);
    setProfileLoaded(false);
  };

// LOGOUT
  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setProfileLoaded(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        profileLoaded,
        login,
        register,
        verifyEmail,
        resendVerificationEmail,
        logout,
        clearSession,
        updateUserProfile,
        updateUserLocal,
        fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

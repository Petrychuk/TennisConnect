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

interface User {
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

  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (
    email: string,
    password: string,
    name: string,
    role: "player" | "coach",
    wantsToOrganize?: boolean
  ) => Promise<User>;
  
    // 🔹 GET current user 
    fetchCurrentUser: () => Promise<User | null>;

    // 🔹 PUT update user (avatar / cover / name)
    updateUserProfile: (updates: Partial<User>) => Promise<User | null>;
  
    // 🔹 локальное обновление (без API)
    updateUserLocal: (user: User) => void;

  logout: () => Promise<void>;
  
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

          if (res.status === 401) {
            // 👤 Гость — это нормально
            if (!cancelled) {
              setUser(null);
              setProfileLoaded(false);
            }
            return;
          }

          if (!res.ok) {
            console.error("Auth init failed:", res.status);
            if (!cancelled) {
              setUser(null);
              setProfileLoaded(false);
            }
            return;
          }

          const data = await res.json();

          // 🔥 поддерживаем оба формата ответа
          const resolvedUser: User | null = data?.user ?? data ?? null;

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
   */
  const register = async (
    email: string,
    password: string,
    name: string,
    role: "player" | "coach",
    wantsToOrganize?: boolean
  ): Promise<User> => {
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

      const userData = await res.json();
      setUser(userData);
      if (!userData.slug) {
        console.warn("User logged in without slug");
      }
      setProfileLoaded(false);

      return userData;
    } finally {
      setLoading(false);
    }
  };
  const fetchCurrentUser = async () => {
    const res = await fetch("/api/auth/me", {
      credentials: "include",
    });
  
    if (!res.ok) {
      throw new Error("Failed to fetch user");
    }
  
    const data = await res.json();
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
        logout,
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

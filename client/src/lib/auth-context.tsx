import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserRole = "player" | "coach" | null;

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  slug: string;
  avatar?: string | null;
  cover?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  profileLoaded: boolean;

  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    name: string,
    role: "player" | "coach"
  ) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  /**
   * INIT AUTH ON APP LOAD
   */
  useEffect(() => {
    async function initAuth() {
      setLoading(true);

      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          setUser(null);
        } else {
          const userData: User = await res.json();
          setUser(userData);

          // Optional preload profile (safe)
          // if (userData.role === "player") {
          //   await fetch("/api/player-profile", {
          //     credentials: "include",
          //   }).catch(() => {});
          // }

          // if (userData.role === "coach") {
          //   await fetch("/api/coach-profile", {
          //     credentials: "include",
          //   }).catch(() => {});
          // }
        }
      } catch (error) {
        console.error("Auth init failed", error);
        setUser(null);
      } finally {
        setProfileLoaded(true);
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  /**
   * LOGIN
   */
  const login = async (email: string, password: string): Promise<User> => {
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!res.ok) {
      setLoading(false);
      const error = await res.json();
      throw new Error(error.message || "Login failed");
    }

    const userData = await res.json();
    setUser(userData);
    setProfileLoaded(false);
    setLoading(false);

    return userData;
  };

  /**
   * REGISTER
   */
  const register = async (
    email: string,
    password: string,
    name: string,
    role: "player" | "coach"
  ): Promise<User> => {
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role }),
      credentials: "include",
    });

    if (!res.ok) {
      setLoading(false);
      const error = await res.json();
      throw new Error(error.message || "Registration failed");
    }

    const userData = await res.json();
    setUser(userData);
    setProfileLoaded(false);
    setLoading(false);

    return userData;
  };

  /**
   * LOGOUT
   */
  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    setProfileLoaded(false);
  };

  /**
   * UPDATE USER (avatar / cover)
   */
  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;

    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("Failed to update user");
    }

    const updatedUser = await res.json();
    setUser(updatedUser);
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
        updateUser,
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

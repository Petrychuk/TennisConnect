import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type UserRole = "player" | "coach" | null;

interface User {
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  cover?: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check local storage on mount
    const storedUser = localStorage.getItem("tennis_connect_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    try {
      localStorage.setItem("tennis_connect_user", JSON.stringify(newUser));
    } catch (e) {
      console.error("Failed to save user to localStorage", e);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("tennis_connect_user");
    // We keep the coach profile in localStorage so it persists in the public listing
    // even after logout, simulating a "published" profile.
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    try {
      localStorage.setItem("tennis_connect_user", JSON.stringify(updatedUser));
    } catch (e) {
      console.error("Failed to update user in localStorage", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

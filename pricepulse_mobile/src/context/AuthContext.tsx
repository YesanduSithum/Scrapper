import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "../types";
import { api, TOKEN_KEY, USER_KEY } from "../services/api";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  error: string | null;
  isLoading: boolean;
  bootstrapping: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const raw = await SecureStore.getItemAsync(USER_KEY);
          if (raw) setUser(JSON.parse(raw) as User);
      } finally {
        setBootstrapping(false);
      }
    };
    void hydrate();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.auth.login(email, password);
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      // Only store essential user data to avoid exceeding 2048 byte limit
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ id: result.user.id, name: result.user.name, email: result.user.email }));
      setUser(result.user);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.auth.register(email, password, name);
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      // Only store essential user data to avoid exceeding 2048 byte limit
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ id: result.user.id, name: result.user.name, email: result.user.email }));
      setUser(result.user);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, error, isLoading, bootstrapping }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


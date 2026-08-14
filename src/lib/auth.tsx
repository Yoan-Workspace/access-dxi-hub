import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  API_CONFIGURED,
  fetchCurrentUser,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
} from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    API_CONFIGURED ? getStoredToken() : null,
  );
  const [loading, setLoading] = useState(API_CONFIGURED);

  const refresh = useCallback(async () => {
    if (!API_CONFIGURED) {
      setUser({ id: 0, username: "demo", displayName: "Démo", role: "admin" });
      setLoading(false);
      return;
    }

    try {
      const current = await fetchCurrentUser();
      setUser(current);
      if (!current) setToken(null);
      else setToken(getStoredToken());
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const loggedIn = await apiLogin(username, password);
    setToken(getStoredToken());
    setUser(loggedIn);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refresh,
    }),
    [user, token, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

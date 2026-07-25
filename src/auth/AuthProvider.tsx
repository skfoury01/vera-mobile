import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  ApiError,
  getCurrentUser,
  login as loginWithApi,
  logout as logoutWithApi,
  logoutAll as logoutAllWithApi,
  removeStoredToken,
  type SafeUser,
} from '@/lib/api';

type LoginInput = {
  email: string;
  password: string;
  deviceName?: string;
  platform?: string;
};

type AuthContextValue = {
  user: SafeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const restoredUser = await getCurrentUser();
      setUser(restoredUser);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await removeStoredToken();
      }

      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      refreshSession().catch(() => {
        setUser(null);
        setIsLoading(false);
      });
    });
  }, [refreshSession]);

  const login = useCallback(async (input: LoginInput) => {
    const signedInUser = await loginWithApi(
      input.email.trim(),
      input.password,
      input.deviceName,
      input.platform ?? Platform.OS
    );
    setUser(signedInUser);
    return signedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutWithApi();
    } finally {
      setUser(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await logoutAllWithApi();
    } finally {
      setUser(null);
    }
  }, []);

  const handleUnauthorized = useCallback(async () => {
    await removeStoredToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      logoutAll,
      refreshSession,
      handleUnauthorized,
    }),
    [user, isLoading, login, logout, logoutAll, refreshSession, handleUnauthorized]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return value;
}

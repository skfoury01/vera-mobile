import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearSessionToken, getSessionToken } from '@/lib/sessionStorage';

export type MobileSession = {
  token: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type AuthContextValue = {
  session: MobileSession | null;
  isLoading: boolean;
  signIn: (input: SignInInput) => Promise<never>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TEMPORARY_AUTH_MESSAGE =
  'Native sign-in is not wired yet. Vera needs a verified mobile authentication endpoint that returns a narrow bearer token; the web HttpOnly session cookie should not be copied into JavaScript.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    const token = await getSessionToken();
    setSession(token ? { token } : null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshSession().catch(() => {
      setSession(null);
      setIsLoading(false);
    });
  }, [refreshSession]);

  const signIn = useCallback(async (_input: SignInInput): Promise<never> => {
    throw new Error(TEMPORARY_AUTH_MESSAGE);
  }, []);

  const signOut = useCallback(async () => {
    await clearSessionToken();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, isLoading, signIn, signOut, refreshSession }),
    [session, isLoading, signIn, signOut, refreshSession]
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

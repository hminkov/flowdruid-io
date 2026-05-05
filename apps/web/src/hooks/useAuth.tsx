import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { trpc, setAuthToken, clearAuthToken, getAuthToken } from '../lib/trpc';

interface User {
  id: string;
  email: string;
  name: string;
  initials?: string;
  role: 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';
  orgId: string;
  teamId: string | null;
  availability?: 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';
  // True once the org has finished its first-run setup. Refresh /
  // login responses don't carry it (we only fetch from /me), so
  // treat undefined as "not yet known" — same as `isLoading`.
  orgOnboarded?: boolean;
}

// Result of step 1 login: either we're done (full session) or we
// need a 6-digit code for step 2.
export type LoginResult =
  | { requires2FA: false }
  | { requires2FA: true; partialToken: string };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginVerify2FA: (partialToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasToken = !!getAuthToken();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hasToken,
    retry: false,
  });

  const refreshMutation = trpc.auth.refresh.useMutation();

  // Handle meQuery result
  useEffect(() => {
    if (!hasToken) return;
    if (meQuery.data) {
      setUser(meQuery.data);
      setIsLoading(false);
    } else if (meQuery.error) {
      clearAuthToken();
      setUser(null);
      setIsLoading(false);
    }
  }, [hasToken, meQuery.data, meQuery.error]);

  // Try refresh if no token
  useEffect(() => {
    if (hasToken) return;
    refreshMutation.mutate(undefined, {
      onSuccess: (data) => {
        setAuthToken(data.accessToken);
        setUser(data.user);
        setIsLoading(false);
      },
      onError: () => {
        setIsLoading(false);
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginMutation = trpc.auth.login.useMutation();
  const loginVerify2FAMutation = trpc.auth.loginVerify2FA.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const result = await loginMutation.mutateAsync({ email, password });
      if ('requires2FA' in result) {
        return { requires2FA: true, partialToken: result.partialToken };
      }
      setAuthToken(result.accessToken);
      setUser(result.user);
      return { requires2FA: false };
    },
    [loginMutation],
  );

  const loginVerify2FA = useCallback(
    async (partialToken: string, code: string) => {
      const result = await loginVerify2FAMutation.mutateAsync({ partialToken, code });
      setAuthToken(result.accessToken);
      setUser(result.user);
    },
    [loginVerify2FAMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    clearAuthToken();
    setUser(null);
  }, [logoutMutation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginVerify2FA, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

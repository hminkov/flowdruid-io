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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const logoutMutation = trpc.auth.logout.useMutation();

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginMutation.mutateAsync({ email, password });
    setAuthToken(result.accessToken);
    setUser(result.user);
  }, [loginMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    clearAuthToken();
    setUser(null);
  }, [logoutMutation]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

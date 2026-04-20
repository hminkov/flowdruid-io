import { Suspense, createContext, lazy, useCallback, useContext, useState, type ReactNode } from 'react';

const UserDetailDrawer = lazy(() =>
  import('../components/UserDetailDrawer').then((m) => ({ default: m.UserDetailDrawer }))
);

type Ctx = {
  openUser: (userId: string) => void;
  closeUser: () => void;
};

const UserDetailContext = createContext<Ctx | null>(null);

export function UserDetailProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);

  const openUser = useCallback((id: string) => setUserId(id), []);
  const closeUser = useCallback(() => setUserId(null), []);

  return (
    <UserDetailContext.Provider value={{ openUser, closeUser }}>
      {children}
      {userId && (
        <Suspense fallback={null}>
          <UserDetailDrawer userId={userId} onClose={closeUser} />
        </Suspense>
      )}
    </UserDetailContext.Provider>
  );
}

export function useUserDetail() {
  const ctx = useContext(UserDetailContext);
  if (!ctx) throw new Error('useUserDetail must be used within UserDetailProvider');
  return ctx;
}

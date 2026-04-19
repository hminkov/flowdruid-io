import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { UserDetailDrawer } from '../components/UserDetailDrawer';

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
      <UserDetailDrawer userId={userId} onClose={closeUser} />
    </UserDetailContext.Provider>
  );
}

export function useUserDetail() {
  const ctx = useContext(UserDetailContext);
  if (!ctx) throw new Error('useUserDetail must be used within UserDetailProvider');
  return ctx;
}

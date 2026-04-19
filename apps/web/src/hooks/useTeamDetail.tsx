import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { TeamDetailDrawer } from '../components/TeamDetailDrawer';

type Ctx = {
  openTeam: (teamId: string) => void;
  closeTeam: () => void;
};

const TeamDetailContext = createContext<Ctx | null>(null);

export function TeamDetailProvider({ children }: { children: ReactNode }) {
  const [teamId, setTeamId] = useState<string | null>(null);

  const openTeam = useCallback((id: string) => setTeamId(id), []);
  const closeTeam = useCallback(() => setTeamId(null), []);

  return (
    <TeamDetailContext.Provider value={{ openTeam, closeTeam }}>
      {children}
      <TeamDetailDrawer teamId={teamId} onClose={closeTeam} />
    </TeamDetailContext.Provider>
  );
}

export function useTeamDetail() {
  const ctx = useContext(TeamDetailContext);
  if (!ctx) throw new Error('useTeamDetail must be used within TeamDetailProvider');
  return ctx;
}

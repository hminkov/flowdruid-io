import { Suspense, createContext, lazy, useCallback, useContext, useState, type ReactNode } from 'react';

const TeamDetailDrawer = lazy(() =>
  import('../components/TeamDetailDrawer').then((m) => ({ default: m.TeamDetailDrawer }))
);

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
      {teamId && (
        <Suspense fallback={null}>
          <TeamDetailDrawer teamId={teamId} onClose={closeTeam} />
        </Suspense>
      )}
    </TeamDetailContext.Provider>
  );
}

export function useTeamDetail() {
  const ctx = useContext(TeamDetailContext);
  if (!ctx) throw new Error('useTeamDetail must be used within TeamDetailProvider');
  return ctx;
}

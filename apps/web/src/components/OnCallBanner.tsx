import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePersistedLocalState } from '../hooks/usePersistedState';
import { trpc } from '../lib/trpc';
import { AlertIcon, ArrowRightIcon, XIcon } from './icons';

export function OnCallBanner() {
  const { user } = useAuth();

  // Dismiss state is keyed by the start date of the current on-call week so a
  // new rota naturally re-shows the banner.
  const [dismissedKey, setDismissedKey] = usePersistedLocalState<string>(
    'flowdruid-oncall-dismissed',
    ''
  );

  const rotaQuery = trpc.resources.prodSupport.useQuery(
    {
      teamId: user?.teamId ?? undefined,
      year: new Date().getFullYear(),
    },
    { enabled: !!user?.teamId }
  );

  if (!user || !user.teamId) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentShift = (rotaQuery.data ?? []).find((s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return start <= today && today <= end;
  });

  if (!currentShift) return null;

  const isPrimary = currentShift.primary.id === user.id;
  const isSecondary = currentShift.secondary.id === user.id;
  if (!isPrimary && !isSecondary) return null;

  const key = new Date(currentShift.startDate).toISOString().slice(0, 10);
  if (dismissedKey === key) return null;

  const partner = isPrimary ? currentShift.secondary : currentShift.primary;
  const role = isPrimary ? 'primary' : 'secondary';

  return (
    <div className="flex items-start gap-3 border-b border-warning-text/20 bg-warning-bg px-6 py-2 text-warning-text">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <span className="text-text-primary">You're on call this week</span>{' '}
        <span className="opacity-80">
          — {role} for {currentShift.team.name}, paired with {partner.name}.
        </span>
      </div>
      <Link
        to="/prod-support"
        className="flex shrink-0 items-center gap-1 rounded border border-warning-text/30 bg-surface-primary/40 px-2 py-0.5 text-xs hover:bg-surface-primary/60"
      >
        View rota
        <ArrowRightIcon className="h-3 w-3" />
      </Link>
      <button
        onClick={() => setDismissedKey(key)}
        aria-label="Dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-surface-primary/40"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

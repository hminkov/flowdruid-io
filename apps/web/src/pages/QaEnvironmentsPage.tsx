import { Suspense, lazy, useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { usePersistedState, usePersistedLocalState } from '../hooks/usePersistedState';
import { BookingSparkline } from '../features/resources/BookingSparkline';
import { paletteFor } from '../components/ui';
import {
  BriefcaseIcon,
  CheckIcon,
  InfoIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
} from '../components/icons';
import type { QaBookingStatus } from '@flowdruid/shared';

const QaBookingModal = lazy(() =>
  import('../features/resources/QaBookingModal').then((m) => ({ default: m.QaBookingModal }))
);
const QaEnvironmentModal = lazy(() =>
  import('../features/resources/QaEnvironmentModal').then((m) => ({ default: m.QaEnvironmentModal }))
);

type Booking = {
  id: string;
  environmentId: string;
  service: string;
  feature: string | null;
  clientTag: string | null;
  devOwnerId: string | null;
  qaOwnerId: string | null;
  status: QaBookingStatus;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  devOwner: { id: string; name: string; initials: string } | null;
  qaOwner: { id: string; name: string; initials: string } | null;
};

type Env = {
  id: string;
  name: string;
  branch: string | null;
  description: string | null;
  order: number;
  bookings: Booking[];
};

const statusLabel: Record<QaBookingStatus, string> = {
  NEW: 'New',
  IN_DEVELOPMENT: 'In development',
  TEST_IN_QA: 'Test in QA',
  READY_FOR_PROD: 'Ready for prod',
  PUSHED_TO_PROD: 'Pushed to prod',
  PAUSED: 'Paused',
};

const statusTone: Record<QaBookingStatus, string> = {
  NEW: 'bg-neutral-bg text-neutral-text',
  IN_DEVELOPMENT: 'bg-info-bg text-info-text',
  TEST_IN_QA: 'bg-warning-bg text-warning-text',
  READY_FOR_PROD: 'bg-brand-50 text-brand-600',
  PUSHED_TO_PROD: 'bg-success-bg text-success-text',
  PAUSED: 'bg-danger-bg text-danger-text',
};

// Lifecycle order for display — active work first, shipped last.
// New → In development → Test in QA → Paused → Ready for prod → Pushed to prod.
const statusRank: Record<QaBookingStatus, number> = {
  NEW: 0,
  IN_DEVELOPMENT: 1,
  TEST_IN_QA: 2,
  PAUSED: 3,
  READY_FOR_PROD: 4,
  PUSHED_TO_PROD: 5,
};

function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const r = statusRank[a.status] - statusRank[b.status];
    if (r !== 0) return r;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

type View = 'grid' | 'compact' | 'table';

const formatRelative = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function statusBreakdown(bookings: Booking[]): { status: QaBookingStatus; count: number }[] {
  const counts: Record<QaBookingStatus, number> = {
    NEW: 0,
    IN_DEVELOPMENT: 0,
    TEST_IN_QA: 0,
    READY_FOR_PROD: 0,
    PUSHED_TO_PROD: 0,
    PAUSED: 0,
  };
  for (const b of bookings) counts[b.status] += 1;
  return (Object.keys(counts) as QaBookingStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => ({ status: s, count: counts[s] }));
}

export function QaEnvironmentsPage() {
  const [statusFilter, setStatusFilter] = usePersistedState('status', 'all');
  const envQuery = trpc.resources.qaEnvironments.useQuery();
  const { openUser } = useUserDetail();
  const { user } = useAuth();
  const canEditBookings = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';
  const canManageEnvs = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';
  const isAdmin = user?.role === 'ADMIN';

  const [view, setView] = usePersistedLocalState<View>('flowdruid-qa-view', 'grid');
  const [sort, setSort] = usePersistedState('sort', 'order');
  const [envFilter, setEnvFilter] = usePersistedState('env', 'all');

  // Booking editor state
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ id: string; name: string } | null>(null);

  // Environment editor state
  const [envEditing, setEnvEditing] = useState<Env | null>(null);
  const [envCreating, setEnvCreating] = useState(false);

  const environments = (envQuery.data ?? []) as Env[];

  const sortedEnvs = useMemo(() => {
    const list = [...environments];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'activity')
      list.sort((a, b) => b.bookings.length - a.bookings.length);
    else list.sort((a, b) => a.order - b.order);
    if (envFilter && envFilter !== 'all') {
      return list.filter((e) => e.id === envFilter);
    }
    return list;
  }, [environments, sort, envFilter]);

  const totalBookings = environments.reduce((a, e) => a + e.bookings.length, 0);
  const busyEnvs = environments.filter((e) =>
    e.bookings.some((b) => b.status !== 'PAUSED' && b.status !== 'PUSHED_TO_PROD')
  ).length;

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>QA environments</h1>
          <p className="mt-1 text-base text-text-secondary">
            Each environment has one KBE branch. Click a person to see their load; click a booking to edit it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary px-3 py-1">
            <BriefcaseIcon className="h-3 w-3" />
            {totalBookings} bookings
          </span>
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary px-3 py-1">
            <RefreshIcon className="h-3 w-3" />
            {busyEnvs}/{environments.length} in use
          </span>
          {canManageEnvs && (
            <button
              onClick={() => setEnvCreating(true)}
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Add environment
            </button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
          {(['all', 'IN_DEVELOPMENT', 'TEST_IN_QA', 'READY_FOR_PROD', 'PAUSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                statusFilter === s || (!statusFilter && s === 'all')
                  ? 'bg-brand-600 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {s === 'all' ? 'All' : statusLabel[s]}
            </button>
          ))}
        </div>

        {/* Env picker */}
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          Env
          <select
            value={envFilter || 'all'}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="min-h-8 rounded border border-border bg-surface-primary px-2 font-mono text-sm text-text-primary"
          >
            <option value="all">All ({environments.length})</option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.branch ? ` · ${e.branch}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
          Sort
          <select
            value={sort || 'order'}
            onChange={(e) => setSort(e.target.value)}
            disabled={envFilter !== 'all' && !!envFilter}
            className="min-h-8 rounded border border-border bg-surface-primary px-2 text-sm text-text-primary disabled:opacity-50"
          >
            <option value="order">Default</option>
            <option value="name">By name</option>
            <option value="activity">Most active</option>
          </select>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
          {(['grid', 'compact', 'table'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-pill px-3 py-1 text-xs transition-colors duration-fast ${
                view === v
                  ? 'bg-brand-600 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {v === 'grid' ? 'Grid' : v === 'compact' ? 'Compact' : 'Table'}
            </button>
          ))}
        </div>
      </div>

      {view === 'table' ? (
        <TableView
          envs={sortedEnvs}
          statusFilter={(statusFilter || 'all') as QaBookingStatus | 'all'}
          canEditBookings={canEditBookings}
          canManageEnvs={canManageEnvs}
          onBookingClick={setEditing}
          onAddBooking={setCreatingIn}
          onEditEnv={setEnvEditing}
          onOpenUser={openUser}
        />
      ) : (
        <div
          className={`grid gap-3 ${
            view === 'compact'
              ? 'lg:grid-cols-2'
              : 'md:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {sortedEnvs.map((env) => {
            const filteredBookings = sortBookings(
              !statusFilter || statusFilter === 'all'
                ? env.bookings
                : env.bookings.filter((b) => b.status === statusFilter)
            );

            return (
              <article
                key={env.id}
                className="rounded-lg border border-border bg-surface-primary p-4 transition-colors duration-fast hover:border-border-strong"
              >
                <EnvCardHeader
                  env={env}
                  filteredCount={filteredBookings.length}
                  canManageEnvs={canManageEnvs}
                  canAddBooking={canEditBookings}
                  onAddBooking={() => setCreatingIn({ id: env.id, name: env.name })}
                  onEditEnv={() => setEnvEditing(env)}
                />

                {env.description && (
                  <p className="mb-2 text-xs text-text-tertiary">{env.description}</p>
                )}

                {/* Status breakdown + last activity */}
                {env.bookings.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {statusBreakdown(env.bookings).map(({ status, count }) => (
                      <span
                        key={status}
                        className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 ${statusTone[status]}`}
                      >
                        <span className="tabular-nums">{count}</span>
                        {statusLabel[status].toLowerCase()}
                      </span>
                    ))}
                    <span className="ml-auto text-text-tertiary">
                      last edit{' '}
                      {formatRelative(
                        env.bookings.reduce(
                          (acc, b) =>
                            new Date(b.updatedAt) > acc ? new Date(b.updatedAt) : acc,
                          new Date(0)
                        )
                      )}
                    </span>
                  </div>
                )}

                {filteredBookings.length === 0 ? (
                  <p className="rounded border border-dashed border-border bg-surface-secondary p-2 text-center text-xs text-text-tertiary">
                    No matching bookings
                  </p>
                ) : view === 'compact' ? (
                  <CompactBookings bookings={filteredBookings} onOpen={canEditBookings ? setEditing : undefined} onOpenUser={openUser} />
                ) : (
                  <div className="space-y-2">
                    {filteredBookings.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => canEditBookings && setEditing(b)}
                        className={`rounded border border-border bg-surface-secondary p-2.5 ${
                          canEditBookings ? 'cursor-pointer hover:border-border-strong' : ''
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-base font-semibold text-text-primary">{b.service}</span>
                            {b.clientTag && <ClientTagPill tag={b.clientTag} />}
                          </div>
                          <span
                            className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${statusTone[b.status]}`}
                          >
                            {statusLabel[b.status]}
                          </span>
                        </div>
                        {b.feature && (
                          <p className="mb-1.5 text-sm text-text-secondary">{b.feature}</p>
                        )}
                        {b.notes && (
                          <p className="mb-1.5 flex items-start gap-1 text-xs text-text-tertiary">
                            <InfoIcon className="mt-0.5 h-3 w-3 shrink-0" />
                            {b.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
                          {b.devOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openUser(b.devOwner!.id);
                              }}
                              className="flex items-center gap-1 hover:text-text-primary"
                            >
                              <span
                                className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                                style={{
                                  background: paletteFor(b.devOwner.id).bg,
                                  color: paletteFor(b.devOwner.id).text,
                                }}
                              >
                                {b.devOwner.initials}
                              </span>
                              dev: {b.devOwner.name.split(' ')[0]}
                            </button>
                          )}
                          {b.qaOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openUser(b.qaOwner!.id);
                              }}
                              className="flex items-center gap-1 hover:text-text-primary"
                            >
                              <span
                                className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                                style={{
                                  background: paletteFor(b.qaOwner.id).bg,
                                  color: paletteFor(b.qaOwner.id).text,
                                }}
                              >
                                {b.qaOwner.initials}
                              </span>
                              QA: {b.qaOwner.name.split(' ')[0]}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <BookingSparkline refs={env.bookings} />
              </article>
            );
          })}

          {environments.length === 0 && !envQuery.isLoading && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
              No environments configured yet.
              {canManageEnvs && (
                <button
                  onClick={() => setEnvCreating(true)}
                  className="ml-2 text-brand-600 underline-offset-2 hover:underline"
                >
                  Add the first one
                </button>
              )}
            </div>
          )}
          {envQuery.isLoading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-40" />)}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border bg-surface-secondary p-3 text-xs text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3" />
          Replaces the old "QA Environment Tracker" spreadsheet. Each environment has a single KBE branch; bookings share it.
        </div>
      </div>

      {(editing || creatingIn) && (
        <Suspense fallback={null}>
          <QaBookingModal
            booking={editing}
            environmentId={creatingIn?.id}
            environmentName={
              creatingIn?.name ?? environments.find((e) => e.id === editing?.environmentId)?.name
            }
            onClose={() => {
              setEditing(null);
              setCreatingIn(null);
            }}
          />
        </Suspense>
      )}

      {(envEditing || envCreating) && (
        <Suspense fallback={null}>
          <QaEnvironmentModal
            existing={envEditing}
            canDelete={isAdmin}
            onClose={() => {
              setEnvEditing(null);
              setEnvCreating(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function ClientTagPill({ tag }: { tag: string }) {
  return (
    <span
      title={`Client tag · ${tag}`}
      className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface-primary px-1.5 py-0.5 font-mono text-[10px] text-text-secondary"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-2.5 w-2.5"
      >
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
      {tag}
    </span>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function EnvCardHeader({
  env,
  filteredCount,
  canManageEnvs,
  canAddBooking,
  onAddBooking,
  onEditEnv,
}: {
  env: Env;
  filteredCount: number;
  canManageEnvs: boolean;
  canAddBooking: boolean;
  onAddBooking: () => void;
  onEditEnv: () => void;
}) {
  return (
    <header className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {/* Single, prominent env name */}
        <div className="flex items-baseline gap-2">
          <h3 className="truncate text-xl font-semibold text-text-primary">{env.name}</h3>
          <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
            {filteredCount === env.bookings.length
              ? `${env.bookings.length} booking${env.bookings.length === 1 ? '' : 's'}`
              : `${filteredCount} / ${env.bookings.length}`}
          </span>
        </div>
        {env.branch ? (
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            title={env.branch}
            className="mt-0.5 inline-flex items-center gap-1 rounded-pill bg-surface-secondary px-2 py-0.5 font-mono text-[11px] text-text-secondary"
          >
            <LinkIcon className="h-3 w-3" />
            <span className="truncate">{env.branch}</span>
          </a>
        ) : canManageEnvs ? (
          <button
            onClick={onEditEnv}
            className="mt-0.5 inline-flex items-center gap-1 rounded-pill border border-dashed border-border px-2 py-0.5 text-[11px] text-text-tertiary hover:border-border-strong hover:text-text-primary"
          >
            <LinkIcon className="h-3 w-3" />
            Set branch
          </button>
        ) : (
          <span className="mt-0.5 inline-flex text-[11px] text-text-tertiary">No branch set</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canAddBooking && (
          <button
            onClick={onAddBooking}
            title={`Add a new service to ${env.name}`}
            className="flex h-9 items-center gap-1.5 rounded-md bg-brand-600 px-3 text-sm font-medium text-white shadow-sm transition-colors duration-fast hover:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add service</span>
          </button>
        )}
        {canManageEnvs && (
          <button
            onClick={onEditEnv}
            title={`Configure ${env.name}`}
            aria-label={`Configure ${env.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-primary text-text-secondary transition-colors duration-fast hover:border-brand-500 hover:text-text-primary"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        )}
      </div>
    </header>
  );
}

function CompactBookings({
  bookings,
  onOpen,
  onOpenUser,
}: {
  bookings: Booking[];
  onOpen?: (b: Booking) => void;
  onOpenUser: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border rounded border border-border bg-surface-secondary">
      {bookings.map((b) => (
        <li
          key={b.id}
          onClick={() => onOpen?.(b)}
          className={`px-3 py-2 ${onOpen ? 'cursor-pointer hover:bg-surface-primary' : ''}`}
        >
          {/* Row 1 — status + service + client-tag + feature + owners */}
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-medium ${statusTone[b.status]}`}
            >
              {statusLabel[b.status]}
            </span>
            <span className="truncate text-sm font-semibold text-text-primary">{b.service}</span>
            {b.clientTag && <ClientTagPill tag={b.clientTag} />}
            {b.feature && (
              <span className="truncate text-xs text-text-tertiary">— {b.feature}</span>
            )}
            <div className="ml-auto flex shrink-0 gap-1">
              {b.devOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenUser(b.devOwner!.id);
                  }}
                  title={`dev: ${b.devOwner.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] ring-1 ring-border"
                  style={{
                    background: paletteFor(b.devOwner.id).bg,
                    color: paletteFor(b.devOwner.id).text,
                  }}
                >
                  {b.devOwner.initials}
                </button>
              )}
              {b.qaOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenUser(b.qaOwner!.id);
                  }}
                  title={`QA: ${b.qaOwner.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] ring-1 ring-border"
                  style={{
                    background: paletteFor(b.qaOwner.id).bg,
                    color: paletteFor(b.qaOwner.id).text,
                  }}
                >
                  {b.qaOwner.initials}
                </button>
              )}
            </div>
          </div>

          {/* Row 2 — notes + updated */}
          {(b.notes || b.updatedAt) && (
            <div className="mt-1 flex items-start justify-between gap-3 pl-[52px] text-[11px] text-text-tertiary">
              {b.notes ? (
                <span className="flex min-w-0 items-start gap-1">
                  <InfoIcon className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">{b.notes}</span>
                </span>
              ) : (
                <span className="opacity-0">·</span>
              )}
              <span className="shrink-0 font-mono">{formatRelative(b.updatedAt)}</span>
            </div>
          )}

          {/* Owners text row — shows names under the avatars */}
          {(b.devOwner || b.qaOwner) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[52px] text-[11px] text-text-tertiary">
              {b.devOwner && (
                <span>
                  dev · <span className="text-text-primary">{b.devOwner.name.split(' ')[0]}</span>
                </span>
              )}
              {b.qaOwner && (
                <span>
                  QA · <span className="text-text-primary">{b.qaOwner.name.split(' ')[0]}</span>
                </span>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TableView({
  envs,
  statusFilter,
  canEditBookings,
  canManageEnvs,
  onBookingClick,
  onAddBooking,
  onEditEnv,
  onOpenUser,
}: {
  envs: Env[];
  statusFilter: QaBookingStatus | 'all';
  canEditBookings: boolean;
  canManageEnvs: boolean;
  onBookingClick: (b: Booking) => void;
  onAddBooking: (env: { id: string; name: string }) => void;
  onEditEnv: (env: Env) => void;
  onOpenUser: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-primary">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-border bg-surface-secondary">
          <tr className="text-left text-xs text-text-tertiary">
            <th className="p-3">Env</th>
            <th className="p-3">Branch</th>
            <th className="p-3">Service</th>
            <th className="p-3">Client</th>
            <th className="p-3">Feature</th>
            <th className="p-3">Status</th>
            <th className="p-3">Owners</th>
            <th className="p-3">Notes</th>
            <th className="p-3">Updated</th>
          </tr>
        </thead>
        <tbody>
          {envs.map((env) => {
            const filtered = sortBookings(
              statusFilter === 'all'
                ? env.bookings
                : env.bookings.filter((b) => b.status === statusFilter)
            );
            if (filtered.length === 0) {
              return (
                <tr key={env.id} className="border-b border-border last:border-b-0">
                  <td className="p-3">
                    <EnvCell env={env} canEditEnv={canManageEnvs} onEditEnv={onEditEnv} canAdd={canEditBookings} onAdd={onAddBooking} />
                  </td>
                  <td className="p-3 font-mono text-xs text-text-tertiary">
                    {env.branch ?? '—'}
                  </td>
                  <td className="p-3 text-text-tertiary" colSpan={7}>
                    No matching bookings
                    {env.description && (
                      <span className="ml-2 text-text-tertiary">· {env.description}</span>
                    )}
                  </td>
                </tr>
              );
            }
            return filtered.map((b, idx) => (
              <tr
                key={b.id}
                onClick={() => canEditBookings && onBookingClick(b)}
                className={`border-b border-border last:border-b-0 ${
                  canEditBookings ? 'cursor-pointer hover:bg-surface-secondary' : ''
                }`}
              >
                <td className="p-3 align-top">
                  {idx === 0 ? (
                    <div>
                      <EnvCell env={env} canEditEnv={canManageEnvs} onEditEnv={onEditEnv} canAdd={canEditBookings} onAdd={onAddBooking} />
                      {env.description && (
                        <p className="mt-1 text-[10px] text-text-tertiary">{env.description}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-text-tertiary">
                        {filtered.length} booking{filtered.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-text-tertiary">↳</span>
                  )}
                </td>
                <td className="p-3 align-top font-mono text-xs text-text-tertiary">
                  {idx === 0 ? env.branch ?? '—' : ''}
                </td>
                <td className="p-3 align-top text-text-primary">{b.service}</td>
                <td className="p-3 align-top">
                  {b.clientTag ? <ClientTagPill tag={b.clientTag} /> : <span className="text-text-tertiary">—</span>}
                </td>
                <td className="p-3 align-top text-text-secondary">{b.feature ?? '—'}</td>
                <td className="p-3 align-top">
                  <span className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${statusTone[b.status]}`}>
                    {statusLabel[b.status]}
                  </span>
                </td>
                <td
                  className="p-3 align-top"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap gap-2 text-xs text-text-tertiary">
                    {b.devOwner && (
                      <button
                        onClick={() => onOpenUser(b.devOwner!.id)}
                        className="flex items-center gap-1 hover:text-text-primary"
                      >
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                          style={{
                            background: paletteFor(b.devOwner.id).bg,
                            color: paletteFor(b.devOwner.id).text,
                          }}
                        >
                          {b.devOwner.initials}
                        </span>
                        dev · {b.devOwner.name.split(' ')[0]}
                      </button>
                    )}
                    {b.qaOwner && (
                      <button
                        onClick={() => onOpenUser(b.qaOwner!.id)}
                        className="flex items-center gap-1 hover:text-text-primary"
                      >
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                          style={{
                            background: paletteFor(b.qaOwner.id).bg,
                            color: paletteFor(b.qaOwner.id).text,
                          }}
                        >
                          {b.qaOwner.initials}
                        </span>
                        QA · {b.qaOwner.name.split(' ')[0]}
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3 align-top text-xs text-text-tertiary">
                  {b.notes ? (
                    <span className="line-clamp-2">{b.notes}</span>
                  ) : (
                    <span className="opacity-50">—</span>
                  )}
                </td>
                <td className="p-3 align-top text-xs text-text-tertiary tabular-nums">
                  {formatRelative(b.updatedAt)}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function EnvCell({
  env,
  canEditEnv,
  onEditEnv,
  canAdd,
  onAdd,
}: {
  env: Env;
  canEditEnv: boolean;
  onEditEnv: (env: Env) => void;
  canAdd: boolean;
  onAdd: (env: { id: string; name: string }) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-600">
        {env.name}
      </span>
      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-fast group-hover:opacity-100 sm:opacity-100">
        {canAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd({ id: env.id, name: env.name });
            }}
            title="Add booking"
            className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-primary hover:text-text-primary"
          >
            <PlusIcon className="h-3 w-3" />
          </button>
        )}
        {canEditEnv && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditEnv(env);
            }}
            title="Set up env"
            className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-primary hover:text-text-primary"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

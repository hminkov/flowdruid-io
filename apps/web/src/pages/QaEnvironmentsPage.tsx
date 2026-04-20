import { useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/useAuth';
import { useUserDetail } from '../hooks/useUserDetail';
import { QaBookingModal } from '../features/resources/QaBookingModal';
import { BriefcaseIcon, CheckIcon, InfoIcon, LinkIcon, PlusIcon, RefreshIcon } from '../components/icons';
import type { QaBookingStatus } from '@flowdruid/shared';

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

const avatarPalettes = [
  { bg: 'var(--avatar-1-bg)', text: 'var(--avatar-1-text)' },
  { bg: 'var(--avatar-2-bg)', text: 'var(--avatar-2-text)' },
  { bg: 'var(--avatar-3-bg)', text: 'var(--avatar-3-text)' },
  { bg: 'var(--avatar-4-bg)', text: 'var(--avatar-4-text)' },
  { bg: 'var(--avatar-5-bg)', text: 'var(--avatar-5-text)' },
  { bg: 'var(--avatar-6-bg)', text: 'var(--avatar-6-text)' },
];
const paletteFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return avatarPalettes[Math.abs(hash) % avatarPalettes.length]!;
};

type Booking = {
  id: string;
  environmentId: string;
  service: string;
  feature: string | null;
  devOwnerId: string | null;
  qaOwnerId: string | null;
  status: QaBookingStatus;
  notes: string | null;
  branch: string | null;
  devOwner: { id: string; name: string; initials: string } | null;
  qaOwner: { id: string; name: string; initials: string } | null;
};

export function QaEnvironmentsPage() {
  const [statusFilter, setStatusFilter] = useState<QaBookingStatus | 'all'>('all');
  const envQuery = trpc.resources.qaEnvironments.useQuery();
  const { openUser } = useUserDetail();
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TEAM_LEAD';

  // Editor state — either a booking (edit) or an envId (create)
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creatingIn, setCreatingIn] = useState<{ id: string; name: string } | null>(null);

  const environments = envQuery.data ?? [];

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
            Which environment is running what. Click a person to see their active load.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary px-3 py-1">
            <BriefcaseIcon className="h-3 w-3" />
            {totalBookings} active bookings
          </span>
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-primary px-3 py-1">
            <RefreshIcon className="h-3 w-3" />
            {busyEnvs}/{environments.length} in use
          </span>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
        {(['all', 'IN_DEVELOPMENT', 'TEST_IN_QA', 'READY_FOR_PROD', 'PAUSED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
              statusFilter === s
                ? 'bg-brand-600 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {s === 'all' ? 'All' : statusLabel[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {environments.map((env) => {
          const filteredBookings =
            statusFilter === 'all'
              ? env.bookings
              : env.bookings.filter((b) => b.status === statusFilter);

          return (
            <article
              key={env.id}
              className="rounded-lg border border-border bg-surface-primary p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 font-mono text-xs text-brand-600">
                    {env.name}
                  </span>
                  <h3 className="truncate">{env.name}</h3>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-text-tertiary">
                    {filteredBookings.length} / {env.bookings.length}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => setCreatingIn({ id: env.id, name: env.name })}
                      title={`Add booking to ${env.name}`}
                      className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <p className="rounded border border-dashed border-border bg-surface-secondary p-2 text-center text-xs text-text-tertiary">
                  No matching bookings
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredBookings.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => canEdit && setEditing(b)}
                      className={`rounded border border-border bg-surface-secondary p-2.5 ${
                        canEdit ? 'cursor-pointer hover:border-border-strong' : ''
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-md text-text-primary">{b.service}</span>
                        <span
                          className={`shrink-0 rounded-pill px-2 py-0.5 text-[10px] ${statusTone[b.status]}`}
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
                        {b.branch && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                            <LinkIcon className="h-3 w-3" />
                            {b.branch}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
        {environments.length === 0 && !envQuery.isLoading && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-surface-primary p-6 text-center text-sm text-text-secondary">
            No environments configured yet.
          </div>
        )}
        {envQuery.isLoading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-40" />)}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-surface-secondary p-3 text-xs text-text-tertiary">
        <div className="flex items-center gap-1.5">
          <CheckIcon className="h-3 w-3" />
          This replaces the old "QA Environment Tracker" spreadsheet. Bookings update the same way as Jira tickets.
        </div>
      </div>

      {(editing || creatingIn) && (
        <QaBookingModal
          booking={editing}
          environmentId={creatingIn?.id}
          environmentName={creatingIn?.name ?? environments.find((e) => e.id === editing?.environmentId)?.name}
          onClose={() => {
            setEditing(null);
            setCreatingIn(null);
          }}
        />
      )}
    </div>
  );
}

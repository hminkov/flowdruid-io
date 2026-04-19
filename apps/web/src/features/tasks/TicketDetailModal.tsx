import { useEffect, useMemo, useState } from 'react';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/useAuth';
import { useUserDetail } from '../../hooks/useUserDetail';
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  LinkIcon,
  SendIcon,
  SpinnerIcon,
  XIcon,
} from '../../components/icons';
import type { Ticket } from './types';
import { STATUS_LABELS } from './types';

const PRIORITY_TONES: Record<string, string> = {
  HIGH: 'bg-danger-bg text-danger-text',
  MEDIUM: 'bg-warning-bg text-warning-text',
  LOW: 'bg-success-bg text-success-text',
};

const STATUS_TONES: Record<string, string> = {
  TODO: 'bg-neutral-bg text-neutral-text',
  IN_PROGRESS: 'bg-info-bg text-info-text',
  IN_REVIEW: 'bg-warning-bg text-warning-text',
  DONE: 'bg-success-bg text-success-text',
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

export function TicketDetailModal({
  ticket,
  onClose,
}: {
  ticket: Ticket | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const open = ticket !== null;

  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const teamsQuery = trpc.teams.list.useQuery(undefined, { enabled: open });
  const suggestionsQuery = trpc.suggestions.list.useQuery(
    { ticketId: ticket?.id ?? '' },
    { enabled: open }
  );
  const createSuggestion = trpc.suggestions.create.useMutation({
    onSuccess: () => {
      utils.suggestions.list.invalidate({ ticketId: ticket?.id ?? '' });
      setShowSuggestForm(false);
      setSelectedUser('');
      setReason('');
      setErrorMsg(null);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const allMembers = useMemo(
    () =>
      (teamsQuery.data ?? []).flatMap((team) =>
        team.members.map((m) => ({ ...m, teamName: team.name }))
      ),
    [teamsQuery.data]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    // Reset when ticket changes
    setShowSuggestForm(false);
    setSelectedUser('');
    setReason('');
    setErrorMsg(null);
  }, [ticket?.id]);

  if (!ticket) return null;

  const assigneeIds = new Set(ticket.assignees.map((a) => a.user.id));

  const handleVolunteer = () => {
    if (!user) return;
    setErrorMsg(null);
    createSuggestion.mutate({
      ticketId: ticket.id,
      suggestedUserId: user.id,
      reason: 'I can take this',
    });
  };

  const handleSubmitSuggestion = () => {
    if (!selectedUser) return;
    setErrorMsg(null);
    createSuggestion.mutate({
      ticketId: ticket.id,
      suggestedUserId: selectedUser,
      reason: reason || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="animate-modal-in relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                  ticket.source === 'JIRA'
                    ? 'bg-info-bg text-info-text'
                    : 'bg-neutral-bg text-neutral-text'
                }`}
              >
                {ticket.jiraKey || `INT-${ticket.id.slice(-4)}`}
              </span>
              <span
                className={`rounded-pill px-2 py-0.5 text-xs ${STATUS_TONES[ticket.status]}`}
              >
                {STATUS_LABELS[ticket.status]}
              </span>
              <span
                className={`rounded-pill px-2 py-0.5 text-xs ${PRIORITY_TONES[ticket.priority]}`}
              >
                {ticket.priority.toLowerCase()} priority
              </span>
            </div>
            <h2 className="text-lg">{ticket.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Description */}
          {(ticket as Ticket & { description?: string | null }).description && (
            <section className="mb-5">
              <h3 className="mb-1.5 text-sm text-text-tertiary">Description</h3>
              <p className="whitespace-pre-wrap text-base text-text-primary">
                {(ticket as Ticket & { description?: string | null }).description}
              </p>
            </section>
          )}

          {/* Assignees */}
          <section className="mb-5">
            <h3 className="mb-2 text-sm text-text-tertiary">
              Assignees{' '}
              <span className="text-text-primary">({ticket.assignees.length})</span>
            </h3>
            {ticket.assignees.length === 0 ? (
              <p className="rounded border border-dashed border-border bg-surface-primary p-3 text-sm text-text-tertiary">
                Nobody assigned yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ticket.assignees.map((a) => {
                  const palette = paletteFor(a.user.id);
                  return (
                    <button
                      key={a.user.id}
                      onClick={() => openUser(a.user.id)}
                      className="flex items-center gap-2 rounded-pill border border-border bg-surface-secondary py-1 pl-1 pr-3 text-sm hover:border-border-strong"
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                        style={{ background: palette.bg, color: palette.text }}
                      >
                        {a.user.initials}
                      </span>
                      <span className="text-text-primary">{a.user.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Suggestions */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm text-text-tertiary">
                Suggestions{' '}
                <span className="text-text-primary">
                  ({suggestionsQuery.data?.length ?? 0})
                </span>
              </h3>
            </div>

            {suggestionsQuery.isLoading && (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              </div>
            )}

            {!suggestionsQuery.isLoading &&
              (suggestionsQuery.data?.length ?? 0) > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {(suggestionsQuery.data ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start gap-2 rounded border border-border bg-surface-primary p-2"
                    >
                      <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <span className="text-text-primary">
                            {s.requester.name}
                          </span>{' '}
                          <span className="text-text-tertiary">
                            suggested
                          </span>{' '}
                          <button
                            onClick={() => openUser(s.suggestedUser.id)}
                            className="text-text-primary underline-offset-2 hover:underline"
                          >
                            {s.suggestedUser.name}
                          </button>
                        </div>
                        {s.reason && (
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {s.reason}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(s.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

            {!suggestionsQuery.isLoading &&
              (suggestionsQuery.data?.length ?? 0) === 0 && (
                <p className="mb-3 rounded border border-dashed border-border bg-surface-primary p-3 text-sm text-text-tertiary">
                  No suggestions yet — be the first.
                </p>
              )}

            {/* Actions */}
            {!showSuggestForm ? (
              <div className="flex flex-wrap gap-2">
                {user && !assigneeIds.has(user.id) && (
                  <button
                    onClick={handleVolunteer}
                    disabled={createSuggestion.isPending}
                    className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800 disabled:opacity-60"
                  >
                    {createSuggestion.isPending ? (
                      <SpinnerIcon className="h-4 w-4" />
                    ) : (
                      <CheckIcon className="h-4 w-4" />
                    )}
                    Request to handle
                  </button>
                )}
                <button
                  onClick={() => setShowSuggestForm(true)}
                  className="flex min-h-input items-center gap-1.5 rounded border border-border bg-surface-primary px-3 text-base text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                >
                  <SendIcon className="h-4 w-4" />
                  Suggest someone else
                </button>
              </div>
            ) : (
              <div className="space-y-2 rounded border border-border bg-surface-secondary p-3">
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">
                    Suggest
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary"
                  >
                    <option value="">Select a teammate…</option>
                    {allMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.teamName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-tertiary">
                    Reason (optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Why is this person a good fit?"
                    className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
                {errorMsg && (
                  <div className="flex items-start gap-1.5 rounded border border-danger-text/20 bg-danger-bg p-2 text-xs text-danger-text">
                    <AlertIcon className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowSuggestForm(false)}
                    className="min-h-input rounded px-3 text-base text-text-secondary hover:bg-surface-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitSuggestion}
                    disabled={!selectedUser || createSuggestion.isPending}
                    className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800 disabled:opacity-60"
                  >
                    {createSuggestion.isPending ? (
                      <SpinnerIcon className="h-4 w-4" />
                    ) : (
                      <SendIcon className="h-4 w-4" />
                    )}
                    Send suggestion
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

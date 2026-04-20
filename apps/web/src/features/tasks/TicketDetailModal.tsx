import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/useAuth';
import { useUserDetail } from '../../hooks/useUserDetail';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  AlertIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  LinkIcon,
  PlusIcon,
  RefreshIcon,
  SendIcon,
  SpinnerIcon,
  XIcon,
} from '../../components/icons';
import {
  Avatar,
  StatusPill,
  useToast,
  paletteFor,
} from '../../components/ui';
import type { Ticket, TicketStatus } from './types';
import { STATUS_LABELS } from './types';

const PRIORITY_TONES: Record<string, string> = {
  HIGH: 'bg-danger-bg text-danger-text',
  MEDIUM: 'bg-warning-bg text-warning-text',
  LOW: 'bg-success-bg text-success-text',
};

import { JIRA_BASE_URL } from '../../config/brand';

export function TicketDetailModal({
  ticket,
  onClose,
}: {
  ticket: Ticket | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { openUser } = useUserDetail();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const open = ticket !== null;
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  // Jump to the task board with this ticket pre-opened. If we're already
  // there, just update the query param — otherwise navigate with it.
  const openOnBoard = () => {
    if (!ticket) return;
    if (location.pathname === '/tasks') {
      const next = new URLSearchParams(location.search);
      next.set('open', ticket.id);
      navigate({ pathname: '/tasks', search: `?${next.toString()}` }, { replace: true });
    } else {
      navigate(`/tasks?open=${encodeURIComponent(ticket.id)}`);
    }
    onClose();
  };

  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState(false);
  const [pointsDraft, setPointsDraft] = useState<string>('');

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
      toast.push({ kind: 'success', title: 'Suggestion sent' });
    },
    onError: (err) => {
      setErrorMsg(err.message);
      toast.push({ kind: 'error', title: 'Could not send suggestion', message: err.message });
    },
  });

  const assignMutation = trpc.tickets.assign.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      toast.push({ kind: 'success', title: 'Assigned to you' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Assignment failed', message: err.message }),
  });

  const updateTicket = trpc.tickets.update.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setEditingPoints(false);
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Update failed', message: err.message }),
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
    setEditingPoints(false);
    const t = ticket as (Ticket & { complexityPoints?: number | null }) | null;
    setPointsDraft(t?.complexityPoints != null ? String(t.complexityPoints) : '');
  }, [ticket?.id]);

  if (!ticket) return null;

  const extended = ticket as Ticket & {
    description?: string | null;
    complexityPoints?: number | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    syncedAt?: string | Date | null;
  };

  const assigneeIds = new Set(ticket.assignees.map((a) => a.user.id));
  const isUnassigned = ticket.assignees.length === 0;
  const isAssignedToMe = user ? assigneeIds.has(user.id) : false;
  const jiraUrl = ticket.jiraKey ? `${JIRA_BASE_URL}/browse/${ticket.jiraKey}` : null;

  const displayKey = ticket.jiraKey || `INT-${ticket.id.slice(-4)}`;
  const shareUrl = `${window.location.origin}/t/${ticket.id}`;

  const handleVolunteer = () => {
    if (!user) return;
    setErrorMsg(null);
    createSuggestion.mutate({
      ticketId: ticket.id,
      suggestedUserId: user.id,
      reason: 'I can take this',
    });
  };

  const handleAssignToMe = () => {
    if (!user) return;
    assignMutation.mutate({ ticketId: ticket.id, userId: user.id, action: 'assign' });
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

  const copy = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.push({ kind: 'success', title: successMsg });
    } catch {
      toast.push({ kind: 'error', title: 'Clipboard blocked', message: 'Copy manually instead' });
    }
  };

  const copyLink = () => copy(shareUrl, 'Link copied');
  const copyRichCard = () => {
    const lines = [
      `[${displayKey}] ${ticket.title}`,
      `Status: ${STATUS_LABELS[ticket.status]} · Priority: ${ticket.priority.toLowerCase()}`,
      ticket.assignees.length > 0
        ? `Assignees: ${ticket.assignees.map((a) => a.user.name).join(', ')}`
        : 'Unassigned',
      shareUrl,
    ];
    return copy(lines.join('\n'), 'Rich card copied');
  };

  const savePoints = () => {
    if (pointsDraft === '') {
      updateTicket.mutate({ ticketId: ticket.id, complexityPoints: null });
      return;
    }
    const n = Number(pointsDraft);
    if (!Number.isInteger(n) || n < 1 || n > 10) {
      toast.push({ kind: 'error', title: 'Complexity must be a whole number between 1 and 10' });
      return;
    }
    updateTicket.mutate({ ticketId: ticket.id, complexityPoints: n });
  };

  // Build the client-derived activity timeline
  type ActivityEntry = {
    id: string;
    at: Date;
    icon: JSX.Element;
    text: JSX.Element;
  };
  const activity: ActivityEntry[] = [];
  if (extended.createdAt) {
    activity.push({
      id: 'created',
      at: new Date(extended.createdAt),
      icon: <PlusIcon className="h-3 w-3" />,
      text: (
        <span>
          Ticket created
          {ticket.source === 'JIRA' ? ' — synced from Jira' : ''}
        </span>
      ),
    });
  }
  if (ticket.source === 'JIRA' && extended.syncedAt) {
    activity.push({
      id: 'synced',
      at: new Date(extended.syncedAt),
      icon: <RefreshIcon className="h-3 w-3" />,
      text: <span>Synced from Jira</span>,
    });
  }
  if (extended.updatedAt) {
    const updated = new Date(extended.updatedAt);
    const created = extended.createdAt ? new Date(extended.createdAt) : null;
    if (!created || Math.abs(updated.getTime() - created.getTime()) > 2000) {
      activity.push({
        id: 'updated',
        at: updated,
        icon: <ArrowRightIcon className="h-3 w-3" />,
        text: <span>Last updated</span>,
      });
    }
  }
  for (const s of suggestionsQuery.data ?? []) {
    activity.push({
      id: `suggestion-${s.id}`,
      at: new Date(s.createdAt),
      icon: <LinkIcon className="h-3 w-3" />,
      text: (
        <span>
          <span className="text-text-primary">{s.requester.name}</span> suggested{' '}
          <button
            className="text-text-primary underline-offset-2 hover:underline"
            onClick={() => openUser(s.suggestedUser.id)}
          >
            {s.suggestedUser.name}
          </button>
          {s.reason ? ` — "${s.reason}"` : ''}
        </span>
      ),
    });
  }
  activity.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--overlay-backdrop)] p-4"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
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
                {displayKey}
              </span>
              {jiraUrl && (
                <a
                  href={jiraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Jira"
                  className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>
              )}
              <StatusPill status={ticket.status} />
              <span className={`rounded-pill px-2 py-0.5 text-xs ${PRIORITY_TONES[ticket.priority]}`}>
                {ticket.priority.toLowerCase()} priority
              </span>
              {extended.complexityPoints != null && !editingPoints && (
                <button
                  onClick={() => setEditingPoints(true)}
                  title="Edit complexity points"
                  className="rounded-pill border border-border bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary"
                >
                  {extended.complexityPoints} pts
                </button>
              )}
            </div>
            <h2 className="text-lg">{ticket.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {location.pathname !== '/tasks' && (
              <button
                onClick={openOnBoard}
                title="Open this ticket on the task board"
                className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-primary px-2.5 text-xs text-text-secondary transition-colors duration-fast hover:border-brand-500 hover:text-text-primary"
              >
                Open on board
                <ArrowRightIcon className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={copyLink}
              title="Copy share link"
              className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
            <button
              onClick={copyRichCard}
              title="Copy rich card (for Slack/email)"
              className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Description */}
          {extended.description && (
            <section className="mb-5">
              <h3 className="mb-1.5 text-sm text-text-tertiary">Description</h3>
              <p className="whitespace-pre-wrap text-base text-text-primary">{extended.description}</p>
            </section>
          )}

          {/* Complexity */}
          <section className="mb-5">
            <h3 className="mb-1.5 text-sm text-text-tertiary">Complexity</h3>
            {editingPoints ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={pointsDraft}
                  onChange={(e) => setPointsDraft(e.target.value)}
                  className="min-h-input w-20 rounded border border-border bg-surface-primary px-2 text-base text-text-primary"
                  autoFocus
                />
                <span className="text-xs text-text-tertiary">points (1–10)</span>
                <button
                  onClick={savePoints}
                  disabled={updateTicket.isPending}
                  className="min-h-input rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingPoints(false);
                    setPointsDraft(
                      extended.complexityPoints != null ? String(extended.complexityPoints) : ''
                    );
                  }}
                  className="min-h-input rounded px-3 text-sm text-text-secondary hover:bg-surface-secondary"
                >
                  Cancel
                </button>
              </div>
            ) : extended.complexityPoints != null ? (
              <div className="flex items-center gap-2">
                <span className="rounded-pill bg-brand-50 px-3 py-0.5 text-sm text-brand-600">
                  {extended.complexityPoints} pts
                </span>
                <button
                  onClick={() => setEditingPoints(true)}
                  className="text-xs text-text-secondary underline-offset-2 hover:underline"
                >
                  Edit
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingPoints(true)}
                className="rounded-pill border border-dashed border-border bg-surface-primary px-3 py-0.5 text-sm text-text-tertiary hover:border-border-strong hover:text-text-primary"
              >
                + Score this ticket
              </button>
            )}
          </section>

          {/* Assignees */}
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm text-text-tertiary">
                Assignees <span className="text-text-primary">({ticket.assignees.length})</span>
              </h3>
              {user && isUnassigned && (
                <button
                  onClick={handleAssignToMe}
                  disabled={assignMutation.isPending}
                  className="flex items-center gap-1 rounded-pill bg-brand-600 px-3 py-0.5 text-xs text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  {assignMutation.isPending ? (
                    <SpinnerIcon className="h-3 w-3" />
                  ) : (
                    <PlusIcon className="h-3 w-3" />
                  )}
                  Assign to me
                </button>
              )}
            </div>
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
                      <Avatar userId={a.user.id} initials={a.user.initials} name={a.user.name} size={24} />
                      <span className="text-text-primary">{a.user.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Suggestions */}
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm text-text-tertiary">
                Suggestions <span className="text-text-primary">({suggestionsQuery.data?.length ?? 0})</span>
              </h3>
            </div>

            {suggestionsQuery.isLoading && (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              </div>
            )}

            {!suggestionsQuery.isLoading && (suggestionsQuery.data?.length ?? 0) > 0 && (
              <ul className="mb-3 space-y-1.5">
                {(suggestionsQuery.data ?? []).map((s) => (
                  <li key={s.id} className="flex items-start gap-2 rounded border border-border bg-surface-primary p-2">
                    <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="text-text-primary">{s.requester.name}</span>{' '}
                        <span className="text-text-tertiary">suggested</span>{' '}
                        <button
                          onClick={() => openUser(s.suggestedUser.id)}
                          className="text-text-primary underline-offset-2 hover:underline"
                        >
                          {s.suggestedUser.name}
                        </button>
                      </div>
                      {s.reason && <p className="mt-0.5 text-xs text-text-secondary">{s.reason}</p>}
                      <div className="mt-1 flex items-center gap-1 text-xs text-text-tertiary">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!suggestionsQuery.isLoading && (suggestionsQuery.data?.length ?? 0) === 0 && (
              <p className="mb-3 rounded border border-dashed border-border bg-surface-primary p-3 text-sm text-text-tertiary">
                No suggestions yet — be the first.
              </p>
            )}

            {/* Actions */}
            {!showSuggestForm ? (
              <div className="flex flex-wrap gap-2">
                {user && !isAssignedToMe && (
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
                  <label className="mb-1 block text-xs text-text-tertiary">Suggest</label>
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
                  <label className="mb-1 block text-xs text-text-tertiary">Reason (optional)</label>
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

          {/* Activity log */}
          <section>
            <h3 className="mb-2 text-sm text-text-tertiary">Activity</h3>
            {activity.length === 0 ? (
              <p className="rounded border border-dashed border-border bg-surface-primary p-3 text-sm text-text-tertiary">
                No activity yet.
              </p>
            ) : (
              <ul className="relative space-y-2 border-l border-border pl-4">
                {activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface-primary text-text-tertiary">
                      {a.icon}
                    </span>
                    <div className="text-sm text-text-secondary">{a.text}</div>
                    <div className="mt-0.5 text-xs text-text-tertiary">
                      {a.at.toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
// TicketStatus re-exported for consumers that already import from this file
export type { TicketStatus };

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { trpc, getAuthToken } from '../../lib/trpc';
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
import { JiraIcon } from '../../components/icons';
import type { Ticket, TicketStatus } from './types';
import { STATUS_LABELS } from './types';

const PRIORITY_TONES: Record<string, string> = {
  HIGH: 'bg-danger-bg text-danger-text',
  MEDIUM: 'bg-warning-bg text-warning-text',
  LOW: 'bg-success-bg text-success-text',
};

import { JIRA_BASE_URL } from '../../config/brand';

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isImage: boolean;
};

function attachmentUrl(ticketId: string, attachmentId: string): string {
  const token = getAuthToken() ?? '';
  return `/api/jira/attachments/${ticketId}/${encodeURIComponent(attachmentId)}?token=${encodeURIComponent(token)}`;
}

/**
 * Parse a Jira description into text + image parts.
 *
 * ADF media nodes were stripped to `{{img:N}}` markers during sync,
 * where N is the 0-based index into `jiraAttachments`. We split on
 * the markers and emit two-typed chunks so the parent can render
 * each part appropriately (whitespace-preserved text, inline images).
 */
function parseDescription(
  text: string,
  attachments: Attachment[],
): Array<{ kind: 'text'; text: string } | { kind: 'image'; att: Attachment }> {
  const parts: Array<{ kind: 'text'; text: string } | { kind: 'image'; att: Attachment }> = [];
  const re = /\{\{img:(\d+)\}\}/g;
  let lastIndex = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > lastIndex) parts.push({ kind: 'text', text: text.slice(lastIndex, start) });
    const idx = Number(m[1]);
    const att = attachments[idx];
    // Only images count for inline rendering — a file attachment
    // listed in the description would look weird inline, so fall back
    // to a link representation in that case (handled by the renderer).
    if (att) parts.push({ kind: 'image', att });
    lastIndex = start + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ kind: 'text', text: text.slice(lastIndex) });
  return parts;
}

function Lightbox({
  url,
  filename,
  onClose,
}: {
  url: string;
  filename: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-8"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full max-w-[90vw] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-white">
          <p className="truncate text-sm opacity-90">{filename}</p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              download={filename}
              className="rounded bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
            >
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <img
          src={url}
          alt={filename}
          className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-float"
        />
      </div>
    </div>
  );
}

// "N min ago" / "2h ago" etc. — same shape as the Audit log page.
function formatRelative(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const [lightbox, setLightbox] = useState<Attachment | null>(null);

  const utils = trpc.useUtils();
  const teamsQuery = trpc.teams.list.useQuery(undefined, { enabled: open });
  // Configured Jira instance URL — only useful (and only fetched) when
  // the open ticket is Jira-sourced. Falls back to the compile-time
  // JIRA_BASE_URL when the org hasn't set a config.
  const jiraBaseUrlQuery = trpc.integrations.jiraBaseUrl.useQuery(undefined, {
    enabled: open && ticket?.source === 'JIRA',
  });
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
    jiraAssigneeName?: string | null;
    jiraAssigneeEmail?: string | null;
    jiraAttachmentCount?: number;
    jiraAttachments?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      isImage: boolean;
    }> | null;
  };

  const assigneeIds = new Set(ticket.assignees.map((a) => a.user.id));
  const isUnassigned = ticket.assignees.length === 0;
  const isAssignedToMe = user ? assigneeIds.has(user.id) : false;
  // Prefer the org-configured Jira base URL; fall back to env default.
  const jiraBase = jiraBaseUrlQuery.data ?? JIRA_BASE_URL;
  const jiraUrl = ticket.jiraKey ? `${jiraBase}/browse/${ticket.jiraKey}` : null;

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
              <button
                type="button"
                onClick={() => copy(displayKey, 'Key copied')}
                title={`Copy ${displayKey}`}
                className={`rounded px-1.5 py-0.5 font-mono text-xs transition-colors duration-fast ${
                  ticket.source === 'JIRA'
                    ? 'bg-info-bg text-info-text hover:bg-info-bg/80'
                    : 'bg-neutral-bg text-neutral-text hover:bg-neutral-bg/80'
                }`}
              >
                {displayKey}
              </button>
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
          {/* Jira provenance banner — only for Jira-sourced tickets.
              Makes the "this lives in Jira" framing explicit: big
              Open-in-Jira button, last-synced timestamp, and a hint
              that title/description are read-only here. */}
          {ticket.source === 'JIRA' && (
            <section className="mb-5 rounded-lg border border-info-text/20 bg-info-bg/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-info-bg text-info-text">
                    <JiraIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm text-text-primary">
                      Synced from Jira
                      <span className="ml-2 font-mono text-xs text-text-secondary">
                        {ticket.jiraKey}
                      </span>
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {extended.syncedAt
                        ? `Last synced ${formatRelative(extended.syncedAt)}`
                        : 'Source of truth is Jira. Status changes here stay local.'}
                    </p>
                  </div>
                </div>
                {jiraUrl && (
                  <a
                    href={jiraUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-input shrink-0 items-center gap-1.5 rounded bg-info-text px-3 text-sm text-white transition-colors duration-fast hover:bg-info-text/85"
                  >
                    Open in Jira
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M7 17L17 7M9 7h8v8" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-info-text/10 pt-2 text-xs text-text-tertiary">
                {(extended.jiraAttachmentCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    {extended.jiraAttachmentCount} image{(extended.jiraAttachmentCount ?? 0) > 1 ? 's' : ''} in Jira — view there
                  </span>
                )}
                <span className="ml-auto">Edit title/description/priority in Jira • drag columns locally</span>
              </div>
            </section>
          )}

          {/* Description — preserve paragraphs/lists from ADF and
              render inline images at the positions they appeared in
              Jira (from {{img:N}} markers the sync emitted). */}
          {extended.description && (
            <section className="mb-5">
              <h3 className="mb-1.5 text-sm text-text-tertiary">Description</h3>
              <div className="space-y-3 text-base leading-relaxed text-text-primary">
                {parseDescription(
                  extended.description,
                  (extended.jiraAttachments ?? []) as Attachment[],
                ).map((part, i) =>
                  part.kind === 'text' ? (
                    <div key={i} className="whitespace-pre-wrap break-words">
                      {part.text}
                    </div>
                  ) : part.att.isImage ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox(part.att)}
                      className="block w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface-secondary transition-opacity hover:opacity-90"
                      title={`Open ${part.att.filename}`}
                    >
                      <img
                        src={attachmentUrl(ticket.id, part.att.id)}
                        alt={part.att.filename}
                        loading="lazy"
                        className="block max-h-80 w-full object-contain"
                      />
                    </button>
                  ) : (
                    <a
                      key={i}
                      href={attachmentUrl(ticket.id, part.att.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-secondary px-2 py-1 text-sm text-text-secondary hover:text-text-primary"
                    >
                      {part.att.filename}
                    </a>
                  ),
                )}
              </div>
            </section>
          )}

          {/* Jira attachments — proxied through /api/jira/attachments so
              the browser can render them without Basic auth. Images
              render inline; non-image files show as download links. */}
          {ticket.source === 'JIRA' && (extended.jiraAttachments?.length ?? 0) > 0 && (
            <section className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm text-text-tertiary">
                  Attachments{' '}
                  <span className="text-text-primary">({extended.jiraAttachments?.length ?? 0})</span>
                </h3>
                {(extended.jiraAttachments?.length ?? 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger a download per attachment via a
                      // temporary <a download> click. 100ms stagger so
                      // the browser doesn't squash concurrent clicks.
                      (extended.jiraAttachments ?? []).forEach((att, i) => {
                        setTimeout(() => {
                          const a = document.createElement('a');
                          a.href = attachmentUrl(ticket.id, att.id);
                          a.download = att.filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }, i * 100);
                      });
                    }}
                    className="flex items-center gap-1 rounded border border-border bg-surface-primary px-2 py-0.5 text-xs text-text-secondary hover:border-brand-500 hover:text-text-primary"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download all
                  </button>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {extended.jiraAttachments?.map((att) => {
                  const url = attachmentUrl(ticket.id, att.id);
                  if (att.isImage) {
                    return (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => setLightbox(att as Attachment)}
                        className="group block overflow-hidden rounded-lg border border-border bg-surface-secondary text-left transition-colors duration-fast hover:border-brand-500"
                        title={att.filename}
                      >
                        <img
                          src={url}
                          alt={att.filename}
                          loading="lazy"
                          className="block h-40 w-full object-cover"
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = 'none';
                            const sibling = el.nextElementSibling as HTMLElement | null;
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                        <div
                          style={{ display: 'none' }}
                          className="flex h-40 items-center justify-center text-xs text-text-tertiary"
                        >
                          Couldn't load {att.filename}
                        </div>
                        <div className="truncate border-t border-border bg-surface-primary px-2 py-1 text-xs text-text-secondary group-hover:text-text-primary">
                          {att.filename}
                        </div>
                      </button>
                    );
                  }
                  return (
                    <a
                      key={att.id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-border bg-surface-secondary p-3 text-sm transition-colors duration-fast hover:border-brand-500"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-text-tertiary">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-text-primary">{att.filename}</p>
                        <p className="text-xs text-text-tertiary">
                          {att.mimeType} · {Math.round(att.size / 1024)} KB
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
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

          {/* Jira assignee — the raw value reported by Jira, separate
              from the local assignees mirror below. Surfaces the
              Jira-side owner even when we couldn't match the email
              to a Flowdruid user. */}
          {ticket.source === 'JIRA' && extended.jiraAssigneeName && (
            <section className="mb-5">
              <h3 className="mb-1.5 text-sm text-text-tertiary">Jira assignee</h3>
              {(() => {
                const jiraEmail = extended.jiraAssigneeEmail ?? '';
                const matched = ticket.assignees.find((a) => {
                  // If the local user's id was added on sync, the link
                  // is implicit — but we don't carry email back on the
                  // ticket list payload, so fall back to name match.
                  return a.user.name === extended.jiraAssigneeName;
                });
                return (
                  <div className="rounded border border-border bg-surface-secondary p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-text-primary">{extended.jiraAssigneeName}</p>
                        {jiraEmail && (
                          <p className="mt-0.5 font-mono text-xs text-text-tertiary">{jiraEmail}</p>
                        )}
                      </div>
                      {matched ? (
                        <button
                          onClick={() => openUser(matched.user.id)}
                          className="flex items-center gap-1.5 rounded-pill bg-success-bg px-2 py-0.5 text-xs text-success-text hover:opacity-80"
                        >
                          <CheckIcon className="h-3 w-3" />
                          Linked to {matched.user.name}
                        </button>
                      ) : (
                        <span
                          title="No Flowdruid user with this email — invite them to auto-link on the next sync."
                          className="rounded-pill bg-warning-bg px-2 py-0.5 text-xs text-warning-text"
                        >
                          No local account
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

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

      {lightbox && (
        <Lightbox
          url={attachmentUrl(ticket.id, lightbox.id)}
          filename={lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
// TicketStatus re-exported for consumers that already import from this file
export type { TicketStatus };

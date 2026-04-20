import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/useAuth';
import { useUserDetail } from '../../hooks/useUserDetail';
import { Avatar, EmptyState, useConfirm, useToast } from '../../components/ui';
import {
  CheckIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SpinnerIcon,
  TeamsIcon,
  TrashIcon,
  XIcon,
} from '../../components/icons';

type Member = { id: string; name: string; initials: string };

export function MessagesTab() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const conversationsQuery = trpc.messages.conversations.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);

  const convos = conversationsQuery.data ?? [];

  // Auto-select the first conversation on load
  useEffect(() => {
    if (!selectedId && convos.length > 0) {
      setSelectedId(convos[0]!.id);
    }
  }, [convos, selectedId]);

  const current = convos.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convos;
    return convos.filter((c) => {
      const name = conversationTitle(c, user?.id);
      const last = c.messages[0]?.body ?? '';
      return name.toLowerCase().includes(q) || last.toLowerCase().includes(q);
    });
  }, [convos, search, user?.id]);

  const markRead = trpc.messages.markRead.useMutation({
    onSuccess: () => {
      utils.messages.conversations.invalidate();
      utils.messages.unreadTotal.invalidate();
    },
  });

  useEffect(() => {
    // When a conversation is opened, mark it read
    if (current && current.unreadCount > 0) {
      markRead.mutate({ conversationId: current.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (conversationsQuery.isLoading) {
    return (
      <div className="grid h-[68vh] grid-cols-[280px_1fr] gap-4">
        <div className="skeleton h-full w-full" />
        <div className="skeleton h-full w-full" />
      </div>
    );
  }

  if (convos.length === 0) {
    return (
      <EmptyState
        icon={<SendIcon className="h-4 w-4" />}
        title="No conversations yet"
        message="Start a DM with a teammate."
        cta={
          <button
            onClick={() => setComposing(true)}
            className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" />
            New message
          </button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex h-[72vh] overflow-hidden rounded-lg border border-border bg-surface-primary">
        {/* Left pane */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface-secondary">
          <div className="space-y-2 border-b border-border p-3">
            <button
              onClick={() => setComposing(true)}
              className="flex w-full min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
            >
              <PlusIcon className="h-4 w-4" />
              New message
            </button>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="min-h-8 w-full rounded border border-border bg-surface-primary pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-text-tertiary">No matches.</p>
            ) : (
              <ul>
                {filtered.map((c) => {
                  const title = conversationTitle(c, user?.id);
                  const other = otherDmMember(c, user?.id);
                  const preview = c.messages[0]?.body ?? '';
                  const author = c.messages[0]?.author;
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className={`flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors duration-fast ${
                          active
                            ? 'bg-brand-50 text-text-primary'
                            : 'hover:bg-surface-primary'
                        }`}
                      >
                        {c.kind === 'TEAM_CHANNEL' ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-600">
                            <TeamsIcon className="h-4 w-4" />
                          </span>
                        ) : other ? (
                          <Avatar
                            userId={other.id}
                            initials={other.initials}
                            name={other.name}
                            size={32}
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-secondary" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm text-text-primary">
                              {c.kind === 'TEAM_CHANNEL' ? '#' : ''}
                              {title}
                            </span>
                            {c.messages[0] && (
                              <span className="shrink-0 text-[10px] text-text-tertiary">
                                {shortTime(c.messages[0].createdAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs text-text-secondary">
                              {preview
                                ? author
                                  ? `${author.name.split(' ')[0]}: ${preview}`
                                  : preview
                                : 'No messages yet'}
                            </p>
                            {c.unreadCount > 0 && (
                              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] text-white">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Right pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {current ? (
            <ThreadPane
              key={current.id}
              conversationId={current.id}
              title={conversationTitle(current, user?.id)}
              kind={current.kind}
              members={current.members.map((m) => m.user)}
              other={otherDmMember(current, user?.id)}
              currentUserId={user?.id ?? ''}
              onDelete={confirm}
              toast={toast}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-tertiary">
              Pick a conversation on the left.
            </div>
          )}
        </div>
      </div>

      {composing && (
        <NewDmModal
          onClose={() => setComposing(false)}
          onOpened={(id) => {
            setSelectedId(id);
            setComposing(false);
            utils.messages.conversations.invalidate();
          }}
        />
      )}
    </>
  );
}

function ThreadPane({
  conversationId,
  title,
  kind,
  members,
  other,
  currentUserId,
  onDelete,
  toast,
}: {
  conversationId: string;
  title: string;
  kind: 'DM' | 'TEAM_CHANNEL';
  members: Member[];
  other: Member | null;
  currentUserId: string;
  onDelete: ReturnType<typeof useConfirm>;
  toast: ReturnType<typeof useToast>;
}) {
  const { openUser } = useUserDetail();
  const utils = trpc.useUtils();
  const messagesQuery = trpc.messages.messages.useQuery(
    { conversationId, limit: 200 },
    { refetchInterval: 15_000 }
  );
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.messages.invalidate({ conversationId });
      utils.messages.conversations.invalidate();
      utils.messages.unreadTotal.invalidate();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Send failed', message: err.message }),
  });
  const edit = trpc.messages.edit.useMutation({
    onSuccess: () => {
      utils.messages.messages.invalidate({ conversationId });
      toast.push({ kind: 'success', title: 'Message updated' });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Edit failed', message: err.message }),
  });
  const del = trpc.messages.delete.useMutation({
    onSuccess: () => {
      utils.messages.messages.invalidate({ conversationId });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Delete failed', message: err.message }),
  });

  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    // Scroll to bottom when messages change
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    send.mutate({ conversationId, body: trimmed });
    setBody('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditBody(text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    edit.mutate({ messageId: editingId, body: editBody.trim() });
    setEditingId(null);
    setEditBody('');
  };

  const handleDelete = async (id: string) => {
    const ok = await onDelete({
      title: 'Delete this message?',
      message: 'It will be hidden for everyone in the conversation.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) del.mutate({ messageId: id });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-surface-primary px-4 py-3">
        <div className="flex items-center gap-2">
          {kind === 'TEAM_CHANNEL' ? (
            <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-50 text-brand-600">
              <TeamsIcon className="h-3.5 w-3.5" />
            </span>
          ) : other ? (
            <Avatar userId={other.id} initials={other.initials} name={other.name} size={28} />
          ) : null}
          <div>
            <p className="text-md text-text-primary">
              {kind === 'TEAM_CHANNEL' ? `#${title}` : title}
            </p>
            <p className="text-xs text-text-tertiary">
              {kind === 'TEAM_CHANNEL'
                ? `${members.length} ${members.length === 1 ? 'member' : 'members'}`
                : 'Direct message'}
            </p>
          </div>
        </div>
        {other && kind === 'DM' && (
          <button
            onClick={() => openUser(other.id)}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            View profile
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto bg-surface-secondary p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
            No messages yet — say hello.
          </div>
        ) : (
          renderMessages(messages, currentUserId, {
            onOpenUser: openUser,
            onEdit: startEdit,
            onDelete: handleDelete,
            editingId,
            editBody,
            onEditBodyChange: setEditBody,
            onEditSave: saveEdit,
            onEditCancel: () => setEditingId(null),
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-border bg-surface-primary p-3"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder={`Message ${kind === 'TEAM_CHANNEL' ? `#${title}` : title}`}
          className="min-h-input max-h-32 w-full resize-none rounded border border-border bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
        />
        <button
          type="submit"
          disabled={!body.trim() || send.isPending}
          title="Send (Enter). Shift+Enter for newline."
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-brand-600 text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {send.isPending ? <SpinnerIcon className="h-4 w-4" /> : <SendIcon className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function renderMessages(
  messages: {
    id: string;
    body: string;
    createdAt: string | Date;
    editedAt: string | Date | null;
    deletedAt: string | Date | null;
    authorId: string;
    author: Member;
  }[],
  currentUserId: string,
  actions: {
    onOpenUser: (id: string) => void;
    onEdit: (id: string, body: string) => void;
    onDelete: (id: string) => void;
    editingId: string | null;
    editBody: string;
    onEditBodyChange: (v: string) => void;
    onEditSave: () => void;
    onEditCancel: () => void;
  }
) {
  const nodes: JSX.Element[] = [];
  let lastDay: string | null = null;
  let lastAuthor: string | null = null;
  let lastAt: number = 0;

  for (const m of messages) {
    const at = new Date(m.createdAt).getTime();
    const day = new Date(m.createdAt).toDateString();

    if (day !== lastDay) {
      nodes.push(
        <div key={`d-${m.id}`} className="my-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] uppercase tracking-widest text-text-tertiary">
            {formatDayDivider(m.createdAt)}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      );
      lastDay = day;
      lastAuthor = null;
    }

    const isRunContinuation =
      lastAuthor === m.authorId && at - lastAt < 5 * 60 * 1000;
    const mine = m.authorId === currentUserId;

    nodes.push(
      <div
        key={m.id}
        className={`group flex gap-2 ${
          isRunContinuation ? 'mt-0.5' : 'mt-2'
        } ${mine ? 'flex-row-reverse' : ''}`}
      >
        {isRunContinuation ? (
          <div className="w-8 shrink-0" />
        ) : (
          <button
            onClick={() => actions.onOpenUser(m.author.id)}
            className="shrink-0"
          >
            <Avatar
              userId={m.author.id}
              initials={m.author.initials}
              name={m.author.name}
              size={32}
            />
          </button>
        )}
        <div className={`flex min-w-0 max-w-[70%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
          {!isRunContinuation && (
            <div
              className={`mb-0.5 flex items-center gap-2 text-xs text-text-tertiary ${
                mine ? 'flex-row-reverse' : ''
              }`}
            >
              <button
                onClick={() => actions.onOpenUser(m.author.id)}
                className="text-text-primary hover:underline"
              >
                {m.author.name}
              </button>
              <span>{shortTime(m.createdAt)}</span>
              {m.editedAt && <span>(edited)</span>}
            </div>
          )}
          {actions.editingId === m.id ? (
            <div className="w-full space-y-1.5">
              <textarea
                value={actions.editBody}
                onChange={(e) => actions.onEditBodyChange(e.target.value)}
                rows={2}
                autoFocus
                className="w-full resize-none rounded border border-border bg-surface-primary px-2 py-1 text-sm text-text-primary"
              />
              <div className="flex justify-end gap-1">
                <button
                  onClick={actions.onEditCancel}
                  className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={actions.onEditSave}
                  disabled={!actions.editBody.trim()}
                  className="flex items-center gap-1 rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  <CheckIcon className="h-3 w-3" />
                  Save
                </button>
              </div>
            </div>
          ) : m.deletedAt ? (
            <p
              className={`rounded-lg px-3 py-1.5 text-sm italic text-text-tertiary ${
                mine ? 'bg-surface-primary' : 'bg-surface-primary'
              }`}
            >
              Message deleted
            </p>
          ) : (
            <div className="relative w-full">
              <div
                className={`whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-sm ${
                  mine ? 'bg-brand-600 text-white' : 'bg-surface-primary text-text-primary'
                }`}
              >
                {renderRichBody(m.body)}
              </div>
              {mine && (
                <div
                  className={`absolute ${
                    mine ? '-left-16' : '-right-16'
                  } top-0 hidden gap-1 group-hover:flex`}
                >
                  <button
                    onClick={() => actions.onEdit(m.id, m.body)}
                    title="Edit"
                    className="flex h-5 w-5 items-center justify-center rounded bg-surface-primary text-text-tertiary hover:text-text-primary"
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
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => actions.onDelete(m.id)}
                    title="Delete"
                    className="flex h-5 w-5 items-center justify-center rounded bg-surface-primary text-text-tertiary hover:bg-danger-bg hover:text-danger-text"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );

    lastAuthor = m.authorId;
    lastAt = at;
  }
  return nodes;
}

/**
 * Simple markdown-ish rendering: **bold**, `code`, @mentions, and auto-linked URLs.
 * Keeps everything inline-safe — no HTML parsing, no XSS risk.
 */
function renderRichBody(body: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  // Tokenise by the union of the four patterns
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|@[a-zA-Z][\w.]*|https?:\/\/[^\s]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(body))) {
    if (match.index > last) {
      out.push(<span key={`t${i++}`}>{body.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      out.push(
        <strong key={`t${i++}`} className="font-medium">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      out.push(
        <code
          key={`t${i++}`}
          className="rounded bg-surface-secondary px-1 font-mono text-xs"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('@')) {
      out.push(
        <span
          key={`t${i++}`}
          className="rounded bg-brand-50 px-1 font-medium text-brand-600"
        >
          {token}
        </span>
      );
    } else {
      out.push(
        <a
          key={`t${i++}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80"
        >
          {token}
        </a>
      );
    }
    last = match.index + token.length;
  }
  if (last < body.length) {
    out.push(<span key={`t${i++}`}>{body.slice(last)}</span>);
  }
  return out;
}

function conversationTitle(
  c: { kind: 'DM' | 'TEAM_CHANNEL'; name: string | null; team: { name: string } | null; members: { user: Member }[] },
  currentUserId: string | undefined
) {
  if (c.kind === 'TEAM_CHANNEL') return c.name ?? c.team?.name ?? 'Team';
  const other = c.members.find((m) => m.user.id !== currentUserId);
  return other?.user.name ?? 'Direct message';
}

function otherDmMember(
  c: { kind: 'DM' | 'TEAM_CHANNEL'; members: { user: Member }[] },
  currentUserId: string | undefined
): Member | null {
  if (c.kind !== 'DM') return null;
  const other = c.members.find((m) => m.user.id !== currentUserId);
  return other?.user ?? null;
}

function shortTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const today = new Date();
  const sameDay = today.toDateString() === d.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDayDivider(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function NewDmModal({
  onClose,
  onOpened,
}: {
  onClose: () => void;
  onOpened: (conversationId: string) => void;
}) {
  const { user } = useAuth();
  const teamsQuery = trpc.teams.list.useQuery();
  const openDm = trpc.messages.openDm.useMutation({
    onSuccess: (data) => onOpened(data.id),
  });
  const [search, setSearch] = useState('');

  const members = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .flatMap((t) =>
          t.members.map((m) => ({ ...m, teamName: t.name }))
        )
        .filter((m) => m.id !== user?.id),
    [teamsQuery.data, user?.id]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.initials.toLowerCase().includes(q) ||
        m.teamName.toLowerCase().includes(q)
    );
  }, [members, search]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center bg-[var(--overlay-backdrop)] p-4 pt-20"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="animate-modal-in relative w-full max-w-modal overflow-hidden rounded-lg bg-surface-primary shadow-float">
        <header className="flex items-center justify-between border-b border-border p-3">
          <h2>New message</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-surface-secondary hover:text-text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>
        <div className="p-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teammates"
              className="min-h-input w-full rounded border border-border bg-surface-primary pl-8 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-text-tertiary">No matches.</p>
          ) : (
            <ul>
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => openDm.mutate({ userId: m.id })}
                    disabled={openDm.isPending}
                    className="flex w-full items-center gap-2 border-b border-border p-3 text-left hover:bg-surface-secondary disabled:opacity-60"
                  >
                    <Avatar userId={m.id} initials={m.initials} name={m.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{m.name}</p>
                      <p className="truncate text-[10px] text-text-tertiary">{m.teamName}</p>
                    </div>
                    {openDm.isPending ? (
                      <SpinnerIcon className="h-4 w-4 text-text-tertiary" />
                    ) : (
                      <SendIcon className="h-3.5 w-3.5 text-text-tertiary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

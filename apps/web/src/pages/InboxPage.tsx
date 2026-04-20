import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { usePersistedState } from '../hooks/usePersistedState';
import { Avatar, EmptyState, useToast } from '../components/ui';
import { MessagesTab } from '../features/messaging/MessagesTab';
import {
  AlertIcon,
  BellIcon,
  BriefcaseIcon,
  CheckIcon,
  InfoIcon,
  LinkIcon,
  MegaphoneIcon,
  PlaneIcon,
  SendIcon,
} from '../components/icons';
import type { NotificationType } from '@flowdruid/shared';

const TYPE_CONFIG: Record<NotificationType, {
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  accent: string;
}> = {
  LEAVE_APPROVED: { icon: PlaneIcon, accent: 'bg-success-bg text-success-text' },
  LEAVE_DENIED: { icon: PlaneIcon, accent: 'bg-danger-bg text-danger-text' },
  LEAVE_PENDING: { icon: PlaneIcon, accent: 'bg-warning-bg text-warning-text' },
  BLOCKER_ON_TEAM: { icon: AlertIcon, accent: 'bg-danger-bg text-danger-text' },
  TICKET_SUGGESTED: { icon: LinkIcon, accent: 'bg-brand-50 text-brand-600' },
  TICKET_ASSIGNED: { icon: BriefcaseIcon, accent: 'bg-info-bg text-info-text' },
  TICKET_STATUS: { icon: CheckIcon, accent: 'bg-neutral-bg text-neutral-text' },
  STANDUP_MENTION: { icon: MegaphoneIcon, accent: 'bg-accent-bg text-accent-text' },
  PROD_SUPPORT_ON_CALL: { icon: AlertIcon, accent: 'bg-warning-bg text-warning-text' },
  GENERIC: { icon: InfoIcon, accent: 'bg-neutral-bg text-neutral-text' },
};

type Tab = 'notifications' | 'messages';

export function InboxPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [tab, setTab] = usePersistedState('tab', 'notifications');
  const activeTab: Tab = tab === 'messages' ? 'messages' : 'notifications';

  const [filter, setFilter] = usePersistedState('filter', 'all');
  const listArgs = useMemo(
    () => ({
      filter: (filter || 'all') as 'all' | 'unread' | 'mentions' | 'actions',
      limit: 50,
    }),
    [filter]
  );

  const notificationsQuery = trpc.notifications.list.useQuery(listArgs, {
    enabled: activeTab === 'notifications',
  });

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Mark read failed', message: err.message }),
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: (data) => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
      toast.push({ kind: 'success', title: `${data.updated} marked as read` });
    },
    onError: (err) => toast.push({ kind: 'error', title: 'Mark all failed', message: err.message }),
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadShown = notifications.filter((n) => !n.read).length;

  const handleClick = (n: (typeof notifications)[number]) => {
    if (!n.read) markRead.mutate({ ids: [n.id] });
    if (n.linkPath) navigate(n.linkPath);
  };

  return (
    <div className="mx-auto max-w-content">
      <header className="mb-6">
        <h1>Inbox</h1>
        <p className="mt-1 text-base text-text-secondary">
          Notifications and team conversations in one place.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
        <button
          onClick={() => setTab('notifications')}
          className={`flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
            activeTab === 'notifications'
              ? 'bg-brand-600 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <BellIcon className="h-3.5 w-3.5" />
          Notifications
        </button>
        <button
          onClick={() => setTab('messages')}
          className={`flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
            activeTab === 'messages'
              ? 'bg-brand-600 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <SendIcon className="h-3.5 w-3.5" />
          Messages
        </button>
      </div>

      {activeTab === 'notifications' ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
              {[
                { v: 'all', label: 'All' },
                { v: 'unread', label: 'Unread' },
                { v: 'mentions', label: 'Mentions' },
                { v: 'actions', label: 'Actions required' },
              ].map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v)}
                  className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                    filter === f.v || (!filter && f.v === 'all')
                      ? 'bg-brand-600 text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {unreadShown > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 rounded-pill border border-border bg-surface-primary px-3 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary disabled:opacity-60"
              >
                <CheckIcon className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {notificationsQuery.isLoading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16 w-full" />
              ))}
            </div>
          )}

          {!notificationsQuery.isLoading && notifications.length === 0 && (
            <EmptyState
              icon={<CheckIcon className="h-4 w-4" />}
              title="You're all caught up"
              message="Nothing matches this filter right now."
            />
          )}

          <ul className="space-y-2">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type as NotificationType];
              const Icon = cfg.icon;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors duration-fast ${
                      n.read
                        ? 'border-border bg-surface-primary hover:border-border-strong'
                        : 'border-brand-500/30 bg-brand-50/40 hover:border-brand-500'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${cfg.accent}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            n.read ? 'text-text-primary' : 'text-text-primary'
                          }`}
                        >
                          {!n.read && (
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-600 align-middle" />
                          )}
                          {n.title}
                        </p>
                        <span className="shrink-0 text-xs text-text-tertiary">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{n.body}</p>
                      )}
                      {n.actor && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-text-tertiary">
                          <Avatar
                            userId={n.actor.id}
                            initials={n.actor.initials}
                            name={n.actor.name}
                            size={14}
                          />
                          {n.actor.name}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <MessagesTab />
      )}
    </div>
  );
}

function formatRelative(iso: string | Date): string {
  const then = typeof iso === 'string' ? new Date(iso) : iso;
  const diffMs = Date.now() - then.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

// Provide a consumable preview for the Dashboard strip
export type InboxPreviewItem = {
  id: string;
  title: string;
  body: string | null;
  type: NotificationType;
  linkPath: string | null;
  read: boolean;
  createdAt: string | Date;
  actor: { id: string; name: string; initials: string } | null;
};

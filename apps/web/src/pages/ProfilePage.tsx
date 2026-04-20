import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePersistedLocalState } from '../hooks/usePersistedState';
import { trpc } from '../lib/trpc';
import { Avatar, AvailabilityBadge, useToast } from '../components/ui';
import {
  AlertIcon,
  CheckIcon,
  KeyIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  UserIcon,
} from '../components/icons';

type Availability = 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';

const AVAILABILITY_OPTIONS: Availability[] = ['AVAILABLE', 'BUSY', 'REMOTE', 'ON_LEAVE'];

type NotificationPrefs = {
  standups: boolean;
  leaveUpdates: boolean;
  suggestions: boolean;
  mentions: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  standups: true,
  leaveUpdates: true,
  suggestions: true,
  mentions: true,
};

export function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [paletteOverride, setPaletteOverride] = usePersistedLocalState<number | null>(
    `flowdruid-avatar-palette-${user?.id ?? 'anon'}`,
    null
  );
  const [prefs, setPrefs] = usePersistedLocalState<NotificationPrefs>(
    `flowdruid-notification-prefs-${user?.id ?? 'anon'}`,
    DEFAULT_PREFS
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const updateAvailability = trpc.users.updateAvailability.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.push({ kind: 'success', title: 'Availability updated' });
    },
    onError: (err) =>
      toast.push({ kind: 'error', title: 'Update failed', message: err.message }),
  });

  if (!user) return null;

  const role = user.role;
  const currentAvailability: Availability = user.availability ?? 'AVAILABLE';

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    // UI-only for now — backend endpoint wired in a later phase.
    toast.push({
      kind: 'info',
      title: 'Password change ready',
      message: 'Backend wiring lands in Phase 5',
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1>My profile</h1>
        <p className="mt-1 text-base text-text-secondary">
          Manage your display, availability, and notification preferences.
        </p>
      </header>

      {/* Identity card */}
      <section className="rounded-lg border border-border bg-surface-primary p-5">
        <div className="flex items-center gap-4">
          <Avatar
            userId={`palette-${paletteOverride ?? 0}-${user.id}`}
            initials={user.initials ?? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            name={user.name}
            size={56}
          />
          <div className="min-w-0 flex-1">
            <h2>{user.name}</h2>
            <p className="flex items-center gap-1.5 text-sm text-text-secondary">
              <MailIcon className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
              {role === 'ADMIN' ? (
                <ShieldIcon className="h-3 w-3" />
              ) : role === 'TEAM_LEAD' ? (
                <KeyIcon className="h-3 w-3" />
              ) : (
                <UserIcon className="h-3 w-3" />
              )}
              {role.replace('_', ' ').toLowerCase()}
            </p>
          </div>
          <AvailabilityBadge status={currentAvailability} />
        </div>
      </section>

      {/* Availability */}
      <section className="rounded-lg border border-border bg-surface-primary p-5">
        <h2 className="mb-1">Availability</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Set how you appear to your teammates today.
        </p>
        <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface-primary p-0.5">
          {AVAILABILITY_OPTIONS.map((opt) => {
            const active = currentAvailability === opt;
            const label = opt.replace('_', ' ').toLowerCase();
            return (
              <button
                key={opt}
                onClick={() => updateAvailability.mutate({ availability: opt })}
                disabled={updateAvailability.isPending || active}
                className={`rounded-pill px-3 py-1 text-sm transition-colors duration-fast ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-tertiary">
          Planning to be away for a day or more? Use the{' '}
          <a className="underline-offset-2 hover:underline" href="/leave/request">
            leave request
          </a>{' '}
          form instead — it notifies your lead.
        </p>
      </section>

      {/* Avatar palette */}
      <section className="rounded-lg border border-border bg-surface-primary p-5">
        <h2 className="mb-1">Avatar palette</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Pick a colour override for your avatar. Visible only to you (stored in your browser).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPaletteOverride(null)}
            className={`rounded-pill border px-3 py-1 text-sm transition-colors duration-fast ${
              paletteOverride === null
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-border bg-surface-primary text-text-secondary hover:text-text-primary'
            }`}
          >
            Auto
          </button>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setPaletteOverride(i)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs ring-2 transition-transform duration-fast hover:scale-110 ${
                paletteOverride === i ? 'ring-brand-500' : 'ring-transparent'
              }`}
              style={{
                background: `var(--avatar-${i + 1}-bg)`,
                color: `var(--avatar-${i + 1}-text)`,
              }}
              title={`Palette ${i + 1}`}
            >
              {user.initials ?? 'AA'}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-tertiary">
          Backend-stored palettes are on the Phase 5 list. For now this is a local preference.
        </p>
      </section>

      {/* Notifications */}
      <section className="rounded-lg border border-border bg-surface-primary p-5">
        <h2 className="mb-1">Notifications</h2>
        <p className="mb-3 text-sm text-text-secondary">
          Which events generate a bell / inbox entry for you. Stored locally until backend wiring.
        </p>
        <div className="space-y-2">
          {(
            [
              ['standups', 'Team standups and capacity updates'],
              ['leaveUpdates', 'Leave request updates (approved / denied)'],
              ['suggestions', "Someone suggested you for a ticket"],
              ['mentions', 'You were @-mentioned in a standup or comment'],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm text-text-primary"
            >
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                className="h-4 w-4 rounded accent-brand-600"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* Password change (UI-only) */}
      <section className="rounded-lg border border-border bg-surface-primary p-5">
        <h2 className="mb-1">Change password</h2>
        <p className="mb-3 text-sm text-text-secondary">Rotate your Cloudruid password.</p>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div className="relative">
            <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8)"
              className="min-h-input rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="min-h-input rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
            />
          </div>
          {passwordError && (
            <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-2 text-xs text-danger-text">
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {passwordError}
            </div>
          )}
          <div>
            <button
              type="submit"
              className="flex min-h-input items-center gap-1.5 rounded bg-brand-600 px-3 text-base text-white hover:bg-brand-800"
            >
              <CheckIcon className="h-4 w-4" />
              Update password
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { Logo } from '../components/ui/Logo';
import { APP_BRAND } from '../config/brand';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  SpinnerIcon,
} from '../components/icons';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      // Bounce to login after a moment so the user can read the
      // confirmation; gives them time to absorb that they'll need to
      // sign in fresh.
      window.setTimeout(() => navigate('/login'), 2500);
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    resetPassword.mutate({ token, newPassword });
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-tertiary p-6">
        <div className="w-full max-w-card rounded-lg border border-border bg-surface-primary p-6 text-center">
          <h1 className="text-xl text-text-primary">Missing reset token</h1>
          <p className="mt-2 text-sm text-text-secondary">
            This page must be opened via the link in your reset email.
          </p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block text-sm text-brand-600 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-tertiary p-6">
      <div className="w-full max-w-card">
        <div className="mb-6 flex flex-col items-center">
          <Logo variant="wordmark" size={36} />
          <span className="mt-1 text-xs text-text-tertiary">by {APP_BRAND}</span>
        </div>

        <div className="rounded-lg border border-border bg-surface-primary p-6">
          <div className="mb-6">
            <h1 className="text-xl text-text-primary">Set a new password</h1>
            <p className="mt-1 text-base text-text-secondary">
              Pick something at least 8 characters long.
            </p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded border border-success-text/20 bg-success-bg p-3 text-sm text-success-text">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Password updated. Redirecting to sign in…</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-3 text-sm text-danger-text">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-text-secondary">New password</label>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="••••••••"
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">Confirm new password</label>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetPassword.isPending}
                className="group flex min-h-input w-full items-center justify-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetPassword.isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    <span>Updating…</span>
                  </>
                ) : (
                  <>
                    <span>Update password</span>
                    <ArrowRightIcon className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

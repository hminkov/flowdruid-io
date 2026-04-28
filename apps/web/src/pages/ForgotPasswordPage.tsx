import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { Logo } from '../components/ui/Logo';
import { APP_BRAND, emailPlaceholder } from '../config/brand';
import { AlertIcon, ArrowRightIcon, CheckIcon, MailIcon, SpinnerIcon } from '../components/icons';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-tertiary p-6">
      <div className="w-full max-w-card">
        <div className="mb-6 flex flex-col items-center">
          <Logo variant="wordmark" size={36} />
          <span className="mt-1 text-xs text-text-tertiary">by {APP_BRAND}</span>
        </div>

        <div className="rounded-lg border border-border bg-surface-primary p-6">
          <div className="mb-6">
            <h1 className="text-xl text-text-primary">Forgot your password?</h1>
            <p className="mt-1 text-base text-text-secondary">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded border border-success-text/20 bg-success-bg p-3 text-sm text-success-text">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  If an account exists for <strong>{email}</strong>, a reset link is on its way.
                  Check your inbox.
                </span>
              </div>
              <Link
                to="/login"
                className="flex min-h-input w-full items-center justify-center gap-2 rounded border border-border bg-surface-primary px-4 text-base text-text-primary hover:bg-surface-tertiary"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {requestReset.isError && (
                <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-3 text-sm text-danger-text">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Something went wrong. Try again.</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm text-text-secondary">Email</label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder={emailPlaceholder()}
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={requestReset.isPending}
                className="group flex min-h-input w-full items-center justify-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestReset.isPending ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <span>Send reset link</span>
                    <ArrowRightIcon className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <Link
                to="/login"
                className="block text-center text-sm text-text-tertiary hover:text-text-secondary"
              >
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

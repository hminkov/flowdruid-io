import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { Logo } from '../components/ui/Logo';
import { APP_BRAND } from '../config/brand';
import { AlertIcon, ArrowRightIcon, CheckIcon, SpinnerIcon } from '../components/icons';

export function OnboardingPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, { refetchOnWindowFocus: false });
  const initialName = meQuery.data?.name?.split(/\s+/)[0]
    ? `${meQuery.data.name.split(/\s+/)[0]}'s workspace`
    : '';

  const [workspaceName, setWorkspaceName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [inviteRaw, setInviteRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  const completeOnboarding = trpc.org.completeOnboarding.useMutation({
    onSuccess: async () => {
      // Force /me to refetch so orgOnboarded flips to true and the
      // ProtectedRoute redirect we just escaped doesn't fire again.
      await utils.auth.me.invalidate();
      navigate('/dashboard');
    },
    onError: (err) => setError(err.message),
  });

  // Pull the auto-generated workspace name as the placeholder so the
  // user sees what we'd default to if they just hit submit.
  const effectiveWorkspaceName = workspaceName.trim() || initialName;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!effectiveWorkspaceName) {
      setError('Workspace name is required');
      return;
    }
    const inviteEmails = inviteRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    completeOnboarding.mutate({
      workspaceName: effectiveWorkspaceName,
      teamName: teamName.trim() || undefined,
      inviteEmails,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-tertiary p-6">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex flex-col items-center">
          <Logo variant="wordmark" size={36} />
          <span className="mt-1 text-xs text-text-tertiary">by {APP_BRAND}</span>
        </div>

        <div className="rounded-lg border border-border bg-surface-primary p-6">
          <div className="mb-6">
            <h1 className="text-xl text-text-primary">Set up your workspace</h1>
            <p className="mt-1 text-base text-text-secondary">
              Two minutes. You can change everything later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-3 text-sm text-danger-text">
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                Workspace name
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={initialName || 'Acme Inc.'}
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Visible at the top of every page in your workspace.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                First team <span className="text-text-tertiary">(optional)</span>
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Engineering"
                className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                We'll add you to this team automatically.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-text-secondary">
                Invite teammates <span className="text-text-tertiary">(optional)</span>
              </label>
              <textarea
                value={inviteRaw}
                onChange={(e) => setInviteRaw(e.target.value)}
                placeholder="alex@acme.com, jordan@acme.com"
                rows={3}
                className="w-full rounded border border-border bg-surface-primary px-3 py-2 text-base text-text-primary placeholder:text-text-tertiary"
              />
              <p className="mt-1 text-xs text-text-tertiary">
                Comma- or newline-separated. They'll be able to sign in with Google
                using these addresses.
              </p>
            </div>

            <button
              type="submit"
              disabled={completeOnboarding.isPending}
              className="group flex min-h-input w-full items-center justify-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {completeOnboarding.isPending ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <span>Setting up…</span>
                </>
              ) : completeOnboarding.isSuccess ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <span>Continue to dashboard</span>
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  MailIcon,
  SpinnerIcon,
} from '../components/icons';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-tertiary">
      {/* Brand panel */}
      <aside className="relative hidden flex-1 overflow-hidden bg-brand-900 lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-[-15%] top-[-15%] h-[28rem] w-[28rem] rounded-full bg-brand-500 blur-[120px]" />
          <div className="absolute bottom-[-25%] right-[-10%] h-[36rem] w-[36rem] rounded-full bg-brand-600 blur-[140px]" />
          <div className="absolute left-[30%] top-[40%] h-[20rem] w-[20rem] rounded-full bg-brand-800 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg backdrop-blur ring-1 ring-white/20">
              F
            </span>
            <span className="text-xl tracking-tight">Flowdruid</span>
          </div>

          <div className="max-w-lg">
            <h2 className="text-2xl leading-tight">
              One workspace for your whole team.
            </h2>
            <p className="mt-4 text-base opacity-80">
              Tasks, standups, leave, and availability — without juggling five tools.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                'Drag-and-drop task board with Jira sync',
                'Daily standups with Slack notifications',
                'Leave requests, approvals, and calendar view',
                'Role-based access: admin, team lead, developer',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-base opacity-90">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs opacity-60">© {new Date().getFullYear()} Cloudruid · Internal</p>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-card">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-base text-white">
              F
            </span>
            <span className="text-xl text-text-primary">Flowdruid</span>
          </div>

          <div className="rounded-lg border border-border bg-surface-primary p-6">
            <div className="mb-6">
              <h1 className="text-xl text-text-primary">Welcome back</h1>
              <p className="mt-1 text-base text-text-secondary">
                Sign in to your Cloudruid workspace
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
                <label className="mb-1 block text-sm text-text-secondary">Email</label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="you@cloudruid.com"
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-text-secondary">Password</label>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex min-h-input w-full items-center justify-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRightIcon className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-text-tertiary">
            Need access? Ask an admin for an invite.
          </p>
        </div>
      </div>
    </div>
  );
}

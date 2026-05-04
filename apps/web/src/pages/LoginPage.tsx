import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/ui/Logo';
import { APP_BRAND, emailPlaceholder } from '../config/brand';
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  MailIcon,
  SpinnerIcon,
} from '../components/icons';

function formatRemaining(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Google "G" glyph — kept inline so the icons package doesn't grow
// for a single-use logo.
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Wall-clock timestamp (ms) when the lockout ends, or null if not
  // locked. Storing the deadline (rather than a remaining-seconds
  // counter) means the timer keeps ticking correctly across re-renders
  // without us having to manage drift.
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { login } = useAuth();
  const navigate = useNavigate();

  // 1Hz tick while locked; clears itself the instant the lockout ends.
  useEffect(() => {
    if (lockedUntil === null) return;
    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (now >= lockedUntil) setLockedUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const remainingSec =
    lockedUntil !== null ? Math.max(0, Math.ceil((lockedUntil - nowMs) / 1000)) : 0;
  const locked = remainingSec > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      // Surface the server's message verbatim — it carries the
      // attempt counter ("N attempts remaining") and the lockout
      // wait time. Fall back to a generic line only for unexpected
      // errors (network, etc.) where there's no useful code.
      const data = (err as { data?: { code?: string; retryAfterSec?: number } } | null)?.data;
      const code = data?.code;
      const message = (err as { message?: string } | null)?.message;
      if (code === 'TOO_MANY_REQUESTS' && typeof data?.retryAfterSec === 'number') {
        setLockedUntil(Date.now() + data.retryAfterSec * 1000);
      }
      if ((code === 'UNAUTHORIZED' || code === 'TOO_MANY_REQUESTS') && message) {
        setError(message);
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-tertiary">
      {/* Brand panel — fixed dark navy so it reads the same in light and dark mode */}
      <aside
        className="relative hidden flex-1 overflow-hidden lg:flex"
        style={{ backgroundColor: '#1A163F' }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-[-15%] top-[-15%] h-[28rem] w-[28rem] rounded-full blur-[120px]"
            style={{ backgroundColor: '#534AB7', opacity: 0.5 }}
          />
          <div
            className="absolute bottom-[-25%] right-[-10%] h-[36rem] w-[36rem] rounded-full blur-[140px]"
            style={{ backgroundColor: '#3C3489', opacity: 0.55 }}
          />
          <div
            className="absolute left-[30%] top-[40%] h-[20rem] w-[20rem] rounded-full blur-[100px]"
            style={{ backgroundColor: '#7F77DD', opacity: 0.3 }}
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-between p-12" style={{ color: '#FFFFFF' }}>
          <div>
            <Logo variant="wordmark" size={48} color="#FFFFFF" />
            <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              by <span className="tracking-wide">{APP_BRAND}</span>
            </p>
          </div>

          <div className="max-w-lg">
            <h2 className="text-2xl leading-tight" style={{ color: '#FFFFFF' }}>
              One workspace for your whole team.
            </h2>
            <p className="mt-4 text-base" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Tasks, standups, leave, and availability — without juggling five tools.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                'Drag-and-drop task board with Jira sync',
                'Daily standups with Slack notifications',
                'Leave requests, approvals, and calendar view',
                'Role-based access: admin, team lead, developer',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-base"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.15)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
                  >
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            © {new Date().getFullYear()} {APP_BRAND} · Internal
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-card">
          <div className="mb-6 flex flex-col items-center lg:hidden">
            <Logo variant="wordmark" size={36} />
            <span className="mt-1 text-xs text-text-tertiary">by {APP_BRAND}</span>
          </div>

          <div className="rounded-lg border border-border bg-surface-primary p-6">
            <div className="mb-6">
              <h1 className="text-xl text-text-primary">Welcome back</h1>
              <p className="mt-1 text-base text-text-secondary">
                Sign in to your {APP_BRAND} workspace
              </p>
            </div>

            <a
              href="/auth/google/start"
              className="mb-4 flex min-h-input w-full items-center justify-center gap-2 rounded border border-border bg-surface-primary px-4 text-base text-text-primary transition-colors duration-fast hover:bg-surface-tertiary"
            >
              <GoogleGlyph className="h-4 w-4" />
              <span>Continue with Google</span>
            </a>

            <div className="mb-4 flex items-center gap-3 text-xs text-text-tertiary">
              <span className="h-px flex-1 bg-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {locked ? (
                <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-3 text-sm text-danger-text">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Too many failed attempts. Try again in{' '}
                    <span className="font-mono">{formatRemaining(remainingSec)}</span>.
                  </span>
                </div>
              ) : (
                error && (
                  <div className="flex items-start gap-2 rounded border border-danger-text/20 bg-danger-bg p-3 text-sm text-danger-text">
                    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )
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
                    disabled={locked}
                    placeholder={emailPlaceholder()}
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60"
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
                    disabled={locked}
                    placeholder="••••••••"
                    className="min-h-input w-full rounded border border-border bg-surface-primary pl-10 pr-3 text-base text-text-primary placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-text-tertiary hover:text-text-secondary"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || locked}
                className="group flex min-h-input w-full items-center justify-center gap-2 rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {locked ? (
                  <>
                    <LockIcon className="h-4 w-4" />
                    <span>
                      Locked — <span className="font-mono">{formatRemaining(remainingSec)}</span>
                    </span>
                  </>
                ) : loading ? (
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

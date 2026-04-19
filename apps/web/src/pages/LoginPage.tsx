import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-card">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-base text-white">
              F
            </span>
            <span className="text-xl text-text-primary">Flowdruid</span>
          </div>

          <div className="rounded-lg border border-border bg-surface-primary p-6">
            <div className="mb-6">
              <h1 className="text-xl text-text-primary">Welcome back</h1>
              <p className="mt-1 text-base text-text-secondary">
                Sign in to your workspace
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded border border-l-accent bg-danger-bg p-3 text-sm text-danger-text">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@company.com"
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="min-h-input w-full rounded border border-border bg-surface-primary px-3 text-base text-text-primary placeholder:text-text-tertiary"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex min-h-input w-full items-center justify-center rounded bg-brand-600 px-4 text-base text-white transition-all duration-fast hover:bg-brand-800 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <svg
                      className="spinner mr-2 h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        fill="currentColor"
                        className="opacity-75"
                        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                      />
                    </svg>
                    Signing in
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-text-tertiary">
            © {new Date().getFullYear()} Flowdruid
          </p>
        </div>
      </div>
    </div>
  );
}

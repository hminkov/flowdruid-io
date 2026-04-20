import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertIcon, RefreshIcon } from '../icons';

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[RouteErrorBoundary]', error, info);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const title = this.props.fallbackTitle ?? 'Something went wrong';

    return (
      <div className="mx-auto flex max-w-card flex-col items-center gap-3 p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger-text">
          <AlertIcon className="h-5 w-5" />
        </span>
        <h2>{title}</h2>
        <p className="text-sm text-text-secondary">
          This page hit an unexpected error. Try reloading — if it keeps happening, reach out on
          Slack.
        </p>
        {import.meta.env?.DEV && (
          <details className="mt-1 w-full rounded border border-border bg-surface-secondary p-2 text-left text-xs">
            <summary className="cursor-pointer text-text-tertiary">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words text-danger-text">
              {error.name}: {error.message}
              {'\n'}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="mt-2 flex gap-2">
          <button
            onClick={this.reset}
            className="flex min-h-input items-center gap-1.5 rounded border border-border px-3 text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
          >
            <RefreshIcon className="h-4 w-4" />
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="min-h-input rounded bg-brand-600 px-3 text-sm text-white hover:bg-brand-800"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

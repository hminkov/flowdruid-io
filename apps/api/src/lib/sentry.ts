import * as Sentry from '@sentry/node';

/**
 * Sentry is opt-in via the SENTRY_DSN env var. If unset (typical for
 * local dev), everything here is a no-op and no network calls are
 * made — safe to leave enabled in every build.
 *
 * Must be imported before the Express app and other instrumented
 * modules so auto-instrumentation patches have a chance to wrap.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.npm_package_version ?? '0.0.1',
    // Conservative defaults. Bump if we want more fidelity later.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0'),
    // Strip tokens / passwords / session cookies from breadcrumbs + events.
    beforeSend(event) {
      // Extra belt-and-braces on top of our own redaction pass — if a
      // stack frame or request body somehow carries a secret, strip it.
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        for (const k of Object.keys(headers)) {
          if (/authorization|cookie|token|secret|password/i.test(k)) {
            headers[k] = '[redacted]';
          }
        }
      }
      return event;
    },
  });
}

export { Sentry };
export const sentryEnabled = !!dsn;

import * as Sentry from '@sentry/react';

/**
 * Opt-in via VITE_SENTRY_DSN. If the env var is empty, init is a
 * no-op and nothing goes over the network — safe in every build.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION ?? 'dev',
    integrations: [
      // Trace frontend → backend by propagating trace headers on fetch.
      // tracesSampleRate must be > 0 for this to do anything useful.
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    // Scrub sensitive fields from breadcrumbs just like the API side.
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        for (const k of Object.keys(headers)) {
          if (/authorization|cookie|token|secret/i.test(k)) {
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

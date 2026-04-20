/**
 * Brand + org defaults.
 *
 * Every "Cloudruid" string in the UI routes through this module so a
 * fork or a rebrand stays a single-file change. Eventually the org
 * name and Jira base URL should come from the /me payload (the
 * Organisation record on the backend already carries them), and this
 * module can become the client-side fallback for pre-login surfaces
 * (login page, first-paint) where the auth context isn't available.
 */

export const APP_BRAND = import.meta.env.VITE_APP_BRAND ?? 'Cloudruid';

export const APP_EMAIL_DOMAIN =
  import.meta.env.VITE_APP_EMAIL_DOMAIN ?? 'cloudruid.com';

export const JIRA_BASE_URL =
  import.meta.env.VITE_JIRA_BASE_URL ?? 'https://cloudruid.atlassian.net';

// Helper: `placeholder={emailPlaceholder()}` → "you@cloudruid.com"
export const emailPlaceholder = (local = 'you') => `${local}@${APP_EMAIL_DOMAIN}`;

import { Resend } from 'resend';
import { logger } from './logger';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  // Plain-text fallback. Most clients render html; a plain version is
  // good practice and Resend wants it for deliverability.
  text: string;
}

export interface SendEmailResult {
  // 'sent' = handed off to the provider successfully.
  // 'logged' = no API key configured; we logged it so a dev can copy
  //            the link out of the API console.
  // 'failed' = provider returned an error; logged at warn so it shows
  //            up in observability without throwing.
  status: 'sent' | 'logged' | 'failed';
  id?: string;
}

let cachedClient: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cachedClient) cachedClient = new Resend(key);
  return cachedClient;
}

function defaultFrom(): string {
  return process.env.EMAIL_FROM ?? 'flowdruid <onboarding@resend.dev>';
}

/**
 * Send a transactional email through Resend, falling back to a
 * structured pino log if no API key is configured. The fallback
 * keeps the dev loop working without anyone needing a Resend account.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();
  if (!client) {
    logger.info(
      { to: input.to, subject: input.subject, body: input.text },
      '[email] RESEND_API_KEY unset — logging instead of sending',
    );
    return { status: 'logged' };
  }

  try {
    const result = await client.emails.send({
      from: defaultFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (result.error) {
      logger.warn({ err: result.error, to: input.to }, '[email] resend returned error');
      return { status: 'failed' };
    }
    return { status: 'sent', id: result.data?.id };
  } catch (err) {
    logger.warn({ err, to: input.to }, '[email] resend threw');
    return { status: 'failed' };
  }
}

/**
 * Render the password-reset email. Pulled out so the auth router
 * stays focused on flow control, not template strings.
 */
export function passwordResetEmail(url: string): { subject: string; html: string; text: string } {
  const subject = 'Reset your flowdruid password';
  const text = `We got a request to reset your flowdruid password. Use the link below within the next hour to set a new one:\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `
    <p>We got a request to reset your flowdruid password.</p>
    <p>
      <a href="${url}" style="display:inline-block;padding:10px 16px;background:#534AB7;color:#fff;text-decoration:none;border-radius:4px;font-family:system-ui,sans-serif">
        Set a new password
      </a>
    </p>
    <p style="color:#555;font-size:12px;font-family:system-ui,sans-serif">
      Or paste this URL into your browser: <br/>
      <code>${url}</code>
    </p>
    <p style="color:#999;font-size:12px;font-family:system-ui,sans-serif">
      This link expires in 1 hour. If you didn't request this, you can ignore this email.
    </p>
  `;
  return { subject, html, text };
}

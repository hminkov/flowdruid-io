import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sendEmail, passwordResetEmail } from './email';

describe('sendEmail', () => {
  const original = process.env.RESEND_API_KEY;
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  });

  it('returns "logged" when RESEND_API_KEY is unset (dev fallback)', async () => {
    const result = await sendEmail({
      to: 'someone@acme.com',
      subject: 'Hello',
      html: '<p>hi</p>',
      text: 'hi',
    });
    expect(result.status).toBe('logged');
  });
});

describe('passwordResetEmail', () => {
  it('embeds the reset URL into both html and text bodies', () => {
    const url = 'http://localhost:5173/reset-password?token=abc123';
    const tpl = passwordResetEmail(url);
    expect(tpl.subject).toMatch(/reset/i);
    expect(tpl.text).toContain(url);
    expect(tpl.html).toContain(url);
  });
});

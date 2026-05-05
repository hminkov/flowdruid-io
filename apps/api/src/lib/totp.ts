import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// 30-second steps with a ±1-step window to absorb mild clock skew —
// the default for `otplib` already, but we lock it in here so a
// future library upgrade can't silently change verification semantics.
authenticator.options = { step: 30, window: 1 };

const ISSUER = 'flowdruid';

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function verifyCode(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  // otplib.verify is strict about whitespace + non-digits; trim and
  // strip spaces so users can paste "123 456".
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  return authenticator.verify({ token: normalized, secret });
}

export function otpAuthUrl(secret: string, label: string): string {
  // The label is shown in the user's authenticator app — use the
  // email so they can tell flowdruid apart from other accounts.
  return authenticator.keyuri(label, ISSUER, secret);
}

export async function qrDataUri(secret: string, label: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl(secret, label));
}

import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './encrypt';

describe('lib/encrypt', () => {
  beforeAll(() => {
    // Setup file already sets ENCRYPTION_KEY; be explicit for clarity.
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    }
  });

  it('round-trips ASCII', () => {
    const plaintext = 'xoxb-not-a-real-slack-token';
    const cipher = encrypt(plaintext);
    expect(cipher).not.toBe(plaintext);
    expect(decrypt(cipher)).toBe(plaintext);
  });

  it('round-trips unicode', () => {
    const plaintext = '🔐 лето summer 夏 🌴';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces different ciphertext each call (IV randomness)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b); // random IV per encrypt
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it('ciphertext is hex:hex:hex shaped (iv:authTag:ct)', () => {
    const packed = encrypt('hello');
    const parts = packed.split(':');
    expect(parts).toHaveLength(3);
    // iv = 12 bytes = 24 hex chars, authTag = 16 bytes = 32 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  it('decryption fails on tampered ciphertext (authTag mismatch)', () => {
    const packed = encrypt('important');
    // Flip one byte in the ciphertext portion.
    const [iv, tag, ct] = packed.split(':');
    const tamperedCt = (ct![0] === '0' ? '1' : '0') + ct!.slice(1);
    const tampered = `${iv}:${tag}:${tamperedCt}`;
    expect(() => decrypt(tampered)).toThrow();
  });

  it('decryption fails on tampered auth tag', () => {
    const packed = encrypt('important');
    const [iv, tag, ct] = packed.split(':');
    const tamperedTag = (tag![0] === '0' ? '1' : '0') + tag!.slice(1);
    expect(() => decrypt(`${iv}:${tamperedTag}:${ct}`)).toThrow();
  });

  it('rejects a malformed (non-three-part) ciphertext with a clear message', () => {
    // A plaintext placeholder accidentally stored in the DB (from an
    // old seed, or a manual insert) must fail fast, not blow up with
    // the cryptic Buffer.from(undefined) error we used to get.
    expect(() => decrypt('PLACEHOLDER-REPLACE-VIA-UI')).toThrow(/malformed ciphertext/i);
    expect(() => decrypt('only:two')).toThrow(/malformed ciphertext/i);
  });

  it('rejects empty / non-string input with a clear message', () => {
    // @ts-expect-error intentionally passing wrong type
    expect(() => decrypt(undefined)).toThrow(/non-empty string/i);
    expect(() => decrypt('')).toThrow(/non-empty string/i);
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    const prev = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = prev;
    }
  });
});

import type { AuditAction, Prisma, PrismaClient } from '@prisma/client';

/**
 * Fields whose values are redacted from the before/after snapshots
 * because they carry secrets (Slack/Jira tokens, password hashes).
 * Matched case-insensitively on the full key name.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'bottoken',
  'refreshtoken',
  'accesstoken',
  'apitoken',
  'signingsecret',
  'secret',
  'encryptionkey',
]);

const isSensitive = (key: string): boolean =>
  SENSITIVE_KEYS.has(key.toLowerCase()) ||
  /token$|secret$|password$/i.test(key);

/**
 * Walks an object graph and replaces any sensitive value with the
 * string "[redacted]". Arrays and plain objects recurse; other values
 * pass through unchanged. Returns a fresh copy — does not mutate.
 */
function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitive(k) ? '[redacted]' : redact(v);
  }
  return out;
}

type AuditCtx = {
  prisma: PrismaClient | Prisma.TransactionClient;
  user: { id: string; orgId: string };
};

type AuditPayload = {
  before?: unknown;
  after?: unknown;
  reason?: string;
};

/**
 * Append a row to the audit log. Use inside the same Prisma
 * transaction as the mutation it's tracing so the write is atomic:
 *
 *   await prisma.$transaction(async (tx) => {
 *     await tx.user.update({ where: { id }, data: { role } });
 *     await audit({ prisma: tx, user: ctx.user }, 'USER_ROLE_CHANGED',
 *                  'User', id, { before: prev, after: next });
 *   });
 *
 * Snapshots are redacted automatically for any field whose key looks
 * like a secret (token, password, secret, etc.).
 */
export async function audit(
  ctx: AuditCtx,
  action: AuditAction,
  entityType: string,
  entityId: string,
  payload: AuditPayload = {},
): Promise<void> {
  await ctx.prisma.auditLog.create({
    data: {
      orgId: ctx.user.orgId,
      actorId: ctx.user.id,
      action,
      entityType,
      entityId,
      before: payload.before !== undefined
        ? (redact(payload.before) as Prisma.InputJsonValue)
        : undefined,
      after: payload.after !== undefined
        ? (redact(payload.after) as Prisma.InputJsonValue)
        : undefined,
      reason: payload.reason,
    },
  });
}

// Re-export for convenience — callers can import the action enum from
// the same module that owns the helper.
export type { AuditAction } from '@prisma/client';

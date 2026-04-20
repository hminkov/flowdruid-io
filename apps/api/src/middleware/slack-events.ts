import crypto from 'crypto';
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';

/**
 * Slack sends the raw request body and expects us to verify that it
 * came from Slack by recomputing an HMAC against `signingSecret`.
 *
 * For the verification to work, the route needs the *raw* body bytes
 * — which means this handler can't sit behind `express.json()`. Wire
 * it up with `express.raw({ type: 'application/json' })` scoped to
 * this route only, or in a dedicated router.
 *
 * Currently handles:
 *  - URL-verification handshake (one-time, on app install)
 *  - Any inbound event, verified + acked (event dispatch is a TODO —
 *    the envelope is parsed and logged)
 */
export async function slackEventsHandler(req: Request, res: Response) {
  const rawBody =
    Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const signature = req.headers['x-slack-signature'] as string | undefined;

  const body = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  // URL-verification challenge fires BEFORE any config is saved, so
  // signature check must not block it.
  if (body?.type === 'url_verification') {
    res.json({ challenge: body.challenge });
    return;
  }

  if (!timestamp || !signature) {
    res.status(400).json({ error: 'Missing signature headers' });
    return;
  }

  // Timestamp must be within 5 minutes — defends against replay.
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
    res.status(400).json({ error: 'Stale or invalid timestamp' });
    return;
  }

  // teamId on the event points at the Slack workspace — we stashed the
  // org's SlackConfig keyed by orgId, so we resolve via a reverse lookup
  // on team-id or just loop org configs (small N) until one verifies.
  const configs = await prisma.slackConfig.findMany();
  let matched = false;
  for (const cfg of configs) {
    let signingSecret: string;
    try {
      signingSecret = decrypt(cfg.signingSecret);
    } catch {
      continue;
    }
    const base = `v0:${timestamp}:${rawBody}`;
    const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');
    // Use timingSafeEqual to avoid leaking via string compare timing.
    try {
      if (
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        matched = true;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!matched) {
    res.status(401).json({ error: 'Signature mismatch' });
    return;
  }

  // TODO: dispatch `body.event` to an inbound queue. Ack within 3 s
  // per Slack's contract — never do real work synchronously here.
  res.sendStatus(200);
}

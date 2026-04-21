import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';
import type { UserPayload } from '../context';
import type { StoredJiraAttachment } from '../services/jira.sync';

/**
 * GET /api/jira/attachments/:ticketId/:attachmentId?token=<jwt>
 *
 * Proxies a single Jira attachment (image or any file) through the
 * API so the browser can render it. Jira attachment URLs require
 * Basic auth; <img> tags can't carry custom headers, hence the proxy.
 *
 * Auth model matches /api/events: the access-token JWT rides in a
 * query param. That's acceptable because:
 *  - the JWT is short-lived (15 min) and bound to the user
 *  - the route also enforces org-scoping via the ticket lookup
 *  - the token doesn't grant more than standard API access
 *
 * We intentionally do NOT require admin role — any authenticated user
 * whose org owns the ticket can view its attachments, same as the
 * description/title they see in the modal.
 */
export async function jiraAttachmentHandler(req: Request, res: Response) {
  const token = (req.query.token as string | undefined) ?? '';
  let user: UserPayload;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
  } catch {
    res.status(401).end();
    return;
  }

  const { ticketId, attachmentId } = req.params as {
    ticketId: string;
    attachmentId: string;
  };
  if (!ticketId || !attachmentId) {
    res.status(400).json({ error: 'missing params' });
    return;
  }

  // Org-scope the ticket lookup so a token from org A can't fetch
  // an attachment owned by org B.
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, team: { orgId: user.orgId } },
    select: { jiraAttachments: true, source: true },
  });
  if (!ticket || ticket.source !== 'JIRA') {
    res.status(404).end();
    return;
  }

  const manifest = (ticket.jiraAttachments ?? []) as unknown as StoredJiraAttachment[];
  const attachment = manifest.find((a) => a.id === attachmentId);
  if (!attachment) {
    res.status(404).end();
    return;
  }

  const config = await prisma.jiraConfig.findUnique({ where: { orgId: user.orgId } });
  if (!config) {
    res.status(503).json({ error: 'Jira not configured' });
    return;
  }

  const apiToken = decrypt(config.apiToken);
  const auth = Buffer.from(`${config.email}:${apiToken}`).toString('base64');
  const base = config.baseUrl.replace(/\/+$/, '');
  // /rest/api/3/attachment/content/<id> is the content-stream endpoint
  // and is the one Jira points browsers at for the original file.
  const upstreamUrl = `${base}/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`;

  let upstream: Response | globalThis.Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Authorization: `Basic ${auth}`, Accept: '*/*' },
      redirect: 'follow',
    });
  } catch (err) {
    res.status(502).json({ error: 'upstream fetch failed', detail: (err as Error).message });
    return;
  }

  if (!upstream.ok) {
    res.status(upstream.status).end();
    return;
  }

  // Proxy Content-Type so the browser renders images correctly, and
  // set Content-Disposition: inline so it shows rather than downloads.
  // Cache aggressively — attachment bytes are immutable.
  res.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') ?? attachment.mimeType ?? 'application/octet-stream',
  );
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(attachment.filename)}"`,
  );
  res.setHeader('Cache-Control', 'private, max-age=86400, immutable');

  // Stream bytes through. Using ArrayBuffer for simplicity — these
  // attachments are typically screenshots / design files (< few MB)
  // and Node buffers them fine. For giant files a pipe would be
  // nicer, but that's a follow-up.
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.status(200).end(buf);
}

import type { Request, Response } from 'express';
import archiver from 'archiver';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';
import type { UserPayload } from '../context';
import type { StoredJiraAttachment } from '../services/jira.sync';

/**
 * GET /api/jira/attachments-zip/:ticketId?token=<jwt>
 *
 * Bundles every attachment on a Jira ticket into a single streaming
 * zip. Fetches each file via the same two-step pattern as the single
 * attachment proxy (Jira Basic-auth → follow signed CDN URL with no
 * auth), pipes bytes straight into the archive so memory footprint
 * stays bounded regardless of total size.
 */
export async function jiraAttachmentZipHandler(req: Request, res: Response) {
  const token = (req.query.token as string | undefined) ?? '';
  let user: UserPayload;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
  } catch {
    res.status(401).end();
    return;
  }

  const { ticketId } = req.params as { ticketId: string };
  if (!ticketId) {
    res.status(400).json({ error: 'missing ticketId' });
    return;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, team: { orgId: user.orgId } },
    select: { jiraAttachments: true, source: true, jiraKey: true },
  });
  if (!ticket || ticket.source !== 'JIRA') {
    res.status(404).end();
    return;
  }

  const manifest = (ticket.jiraAttachments ?? []) as unknown as StoredJiraAttachment[];
  if (manifest.length === 0) {
    res.status(404).json({ error: 'no attachments' });
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

  const archiveName = `${ticket.jiraKey ?? ticketId}-attachments.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(archiveName)}"`,
  );

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('warning', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'ENOENT') throw err;
  });
  archive.on('error', (err: Error) => {
    // Can't abort cleanly once headers are sent; just log and end.
    // The client will see a truncated zip which fails extraction —
    // acceptable for a best-effort dev experience.
    console.error('jira-attachment-zip: archive error', err.message);
    res.end();
  });
  archive.pipe(res);

  // Dedup filenames by appending (2), (3)... since Jira allows multiple
  // attachments with the same name and zip entries must be unique.
  const seen = new Map<string, number>();
  for (const att of manifest) {
    const bytes = await fetchAttachmentBytes(base, auth, att.id);
    if (!bytes) continue; // skip failed individual file rather than abort

    const count = seen.get(att.filename) ?? 0;
    seen.set(att.filename, count + 1);
    const name = count === 0 ? att.filename : insertCountSuffix(att.filename, count + 1);
    archive.append(bytes, { name });
  }

  await archive.finalize();
}

// Step through Jira's 303 redirect to the signed CDN URL (same as
// single-attachment proxy) and return the raw bytes.
async function fetchAttachmentBytes(
  base: string,
  auth: string,
  attachmentId: string,
): Promise<Buffer | null> {
  try {
    const upstreamUrl = `${base}/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`;
    const first = await fetch(upstreamUrl, {
      headers: { Authorization: `Basic ${auth}`, Accept: '*/*' },
      redirect: 'manual',
    });
    let res: globalThis.Response = first;
    if (
      first.status === 301 ||
      first.status === 302 ||
      first.status === 303 ||
      first.status === 307 ||
      first.status === 308
    ) {
      const location = first.headers.get('location');
      if (!location) return null;
      res = await fetch(location, { headers: { Accept: '*/*' } });
    }
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// "shot.png" with count 2 → "shot (2).png"; "readme" → "readme (2)"
function insertCountSuffix(filename: string, count: number): string {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return `${filename} (${count})`;
  return `${filename.slice(0, dot)} (${count})${filename.slice(dot)}`;
}

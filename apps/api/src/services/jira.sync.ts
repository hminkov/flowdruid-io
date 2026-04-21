import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';
import type { TicketStatus, TicketPriority } from '@prisma/client';

export function mapJiraStatus(jiraStatus: string): TicketStatus {
  const s = jiraStatus.toLowerCase();
  if (s === 'to do' || s === 'open' || s === 'backlog') return 'TODO';
  if (s === 'in progress') return 'IN_PROGRESS';
  if (s === 'in review' || s === 'code review') return 'IN_REVIEW';
  if (s === 'done' || s === 'closed' || s === 'resolved') return 'DONE';
  return 'TODO';
}

export function mapJiraPriority(jiraPriority: string): TicketPriority {
  const p = jiraPriority.toLowerCase();
  if (p === 'highest' || p === 'high') return 'HIGH';
  if (p === 'medium') return 'MEDIUM';
  return 'LOW';
}

export function stripAdf(description: unknown): string {
  if (!description || typeof description !== 'object') return '';
  try {
    const doc = description as { content?: Array<{ content?: Array<{ text?: string }> }> };
    return (
      doc.content
        ?.flatMap((block) => block.content?.map((inline) => inline.text || '') || [])
        .join(' ')
        .trim() || ''
    );
  } catch {
    return '';
  }
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: unknown;
    status: { name: string };
    priority: { name: string };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    } | null;
  };
}

export async function syncJiraTickets(orgId: string): Promise<void> {
  const config = await prisma.jiraConfig.findUnique({ where: { orgId } });
  if (!config) return;

  const apiToken = decrypt(config.apiToken);
  const auth = Buffer.from(`${config.email}:${apiToken}`).toString('base64');

  // Get the first team in the org for ticket assignment
  const defaultTeam = await prisma.team.findFirst({ where: { orgId } });
  if (!defaultTeam) return;

  for (const projectKey of config.projectKeys) {
    const jql = encodeURIComponent(`project=${projectKey}`);
    const url = `${config.baseUrl}/rest/api/3/search?jql=${jql}&maxResults=100&fields=summary,status,priority,assignee,description`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.error(`Jira sync failed for ${projectKey}: ${res.status}`);
      continue;
    }

    const data = (await res.json()) as { issues: JiraIssue[] };

    for (const issue of data.issues) {
      const ticket = await prisma.ticket.upsert({
        where: { jiraKey: issue.key },
        create: {
          source: 'JIRA',
          jiraKey: issue.key,
          jiraId: issue.id,
          title: issue.fields.summary,
          description: stripAdf(issue.fields.description),
          status: mapJiraStatus(issue.fields.status.name),
          priority: mapJiraPriority(issue.fields.priority.name),
          teamId: defaultTeam.id,
          syncedAt: new Date(),
        },
        update: {
          title: issue.fields.summary,
          description: stripAdf(issue.fields.description),
          status: mapJiraStatus(issue.fields.status.name),
          priority: mapJiraPriority(issue.fields.priority.name),
          syncedAt: new Date(),
        },
      });

      // Assignee mapping — if Jira's assignee email matches a User in
      // this org, mirror the assignment into TicketAssignment. The
      // table uses a composite PK on (ticketId, userId), so the upsert
      // is idempotent (no duplicate rows on repeat syncs).
      //
      // Unassigned in Jira → clear local assignments for that ticket so
      // the two sides stay consistent. If the Jira email doesn't match
      // anyone locally, skip silently — visible as a gap in the UI until
      // an admin adds the user.
      const email = issue.fields.assignee?.emailAddress;
      if (email) {
        const user = await prisma.user.findFirst({
          where: { email, orgId, active: true },
          select: { id: true },
        });
        if (user) {
          await prisma.ticketAssignment.upsert({
            where: { ticketId_userId: { ticketId: ticket.id, userId: user.id } },
            create: { ticketId: ticket.id, userId: user.id },
            update: {},
          });
          // Remove any stale assignments on this ticket that don't match
          // the current Jira assignee — single-assignee semantics match
          // how Jira models it.
          await prisma.ticketAssignment.deleteMany({
            where: { ticketId: ticket.id, userId: { not: user.id } },
          });
        }
      } else {
        // Explicitly unassigned in Jira — clear any local assignments.
        await prisma.ticketAssignment.deleteMany({ where: { ticketId: ticket.id } });
      }
    }
  }

  await prisma.jiraConfig.update({
    where: { orgId },
    data: { lastSyncAt: new Date() },
  });
}

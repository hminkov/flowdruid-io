import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';
import type { TicketStatus, TicketPriority } from '@prisma/client';

export function mapJiraStatus(jiraStatus: string): TicketStatus {
  const s = jiraStatus.toLowerCase().trim();
  if (s === 'to do' || s === 'open' || s === 'open issues' || s === 'backlog') return 'TODO';
  if (s === 'blocked' || s === 'on hold') return 'BLOCKED';
  if (s === 'in progress') return 'IN_PROGRESS';
  if (
    s === 'in review' ||
    s === 'code review' ||
    s === 'developer review' ||
    s === 'dev review'
  ) return 'IN_REVIEW';
  if (
    s === 'ready for verification' ||
    s === 'ready for qa' ||
    s === 'in qa' ||
    s === 'qa'
  ) return 'READY_FOR_VERIFICATION';
  if (s === 'done' || s === 'closed' || s === 'resolved' || s === 'verified') return 'DONE';
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
    priority?: { name: string } | null;
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    } | null;
  };
}

export interface SyncReport {
  ok: boolean;
  perProject: Array<{
    projectKey: string;
    status: number | null;
    count: number;
    error?: string;
  }>;
  totalUpserted: number;
}

export async function syncJiraTickets(orgId: string): Promise<SyncReport> {
  const config = await prisma.jiraConfig.findUnique({ where: { orgId } });
  if (!config) return { ok: false, perProject: [], totalUpserted: 0 };

  const apiToken = decrypt(config.apiToken);
  const auth = Buffer.from(`${config.email}:${apiToken}`).toString('base64');

  // Every Jira ticket needs a local teamId because of the schema FK.
  // Use the first team in the org as a default bucket — an admin can
  // rebucket later via the ticket edit UI.
  const defaultTeam = await prisma.team.findFirst({ where: { orgId } });
  if (!defaultTeam) return { ok: false, perProject: [], totalUpserted: 0 };

  // Strip trailing slashes — the saved baseUrl often has one, and
  // '//rest/api/...' 404s on some Jira tenants.
  const base = config.baseUrl.replace(/\/+$/, '');

  const report: SyncReport = { ok: true, perProject: [], totalUpserted: 0 };

  for (const projectKey of config.projectKeys) {
    let count = 0;
    let statusCode: number | null = null;
    try {
      // Modern Jira Cloud endpoint. Atlassian retired /rest/api/3/search
      // in 2025 in favour of POST /rest/api/3/search/jql with cursor
      // pagination. We walk nextPageToken; small/medium projects stop
      // on the first page with isLast=true.
      let nextPageToken: string | null = null;
      let hadError = false;
      do {
        const res = await fetch(`${base}/rest/api/3/search/jql`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jql: `project = "${projectKey}" ORDER BY updated DESC`,
            fields: ['summary', 'status', 'priority', 'assignee', 'description'],
            ...(nextPageToken ? { nextPageToken } : {}),
          }),
        });

        statusCode = res.status;
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          report.perProject.push({
            projectKey,
            status: res.status,
            count: 0,
            error: `${res.status} ${body.slice(0, 300)}`,
          });
          report.ok = false;
          hadError = true;
          break;
        }

        const data = (await res.json()) as {
          issues: JiraIssue[];
          nextPageToken?: string;
          isLast?: boolean;
        };
        const issues = data.issues ?? [];
        for (const issue of issues) {
          await upsertJiraIssue(issue, defaultTeam.id, orgId);
          count++;
        }
        nextPageToken = data.isLast === false && data.nextPageToken ? data.nextPageToken : null;
      } while (nextPageToken);

      if (!hadError) {
        report.perProject.push({ projectKey, status: statusCode, count });
        report.totalUpserted += count;
      }
    } catch (err) {
      report.perProject.push({
        projectKey,
        status: statusCode,
        count,
        error: (err as Error).message,
      });
      report.ok = false;
    }
  }

  await prisma.jiraConfig.update({
    where: { orgId },
    data: { lastSyncAt: new Date() },
  });
  return report;
}

async function upsertJiraIssue(
  issue: JiraIssue,
  defaultTeamId: string,
  orgId: string,
): Promise<void> {
  const ticket = await prisma.ticket.upsert({
    where: { jiraKey: issue.key },
    create: {
      source: 'JIRA',
      jiraKey: issue.key,
      jiraId: issue.id,
      title: issue.fields.summary,
      description: stripAdf(issue.fields.description),
      status: mapJiraStatus(issue.fields.status?.name ?? ''),
      priority: mapJiraPriority(issue.fields.priority?.name ?? ''),
      teamId: defaultTeamId,
      syncedAt: new Date(),
    },
    update: {
      title: issue.fields.summary,
      description: stripAdf(issue.fields.description),
      status: mapJiraStatus(issue.fields.status?.name ?? ''),
      priority: mapJiraPriority(issue.fields.priority?.name ?? ''),
      syncedAt: new Date(),
    },
  });

  // Assignee mapping — if Jira's assignee email matches a User in
  // this org, mirror the assignment. Unassigned → clear local rows.
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
      await prisma.ticketAssignment.deleteMany({
        where: { ticketId: ticket.id, userId: { not: user.id } },
      });
    }
  } else {
    await prisma.ticketAssignment.deleteMany({ where: { ticketId: ticket.id } });
  }
}

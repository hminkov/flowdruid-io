import { prisma } from '../lib/prisma';
import { decrypt } from '../lib/encrypt';
import type { TicketStatus, TicketPriority } from '@prisma/client';

function mapJiraStatus(jiraStatus: string): TicketStatus {
  const s = jiraStatus.toLowerCase();
  if (s === 'to do' || s === 'open' || s === 'backlog') return 'TODO';
  if (s === 'in progress') return 'IN_PROGRESS';
  if (s === 'in review' || s === 'code review') return 'IN_REVIEW';
  if (s === 'done' || s === 'closed' || s === 'resolved') return 'DONE';
  return 'TODO';
}

function mapJiraPriority(jiraPriority: string): TicketPriority {
  const p = jiraPriority.toLowerCase();
  if (p === 'highest' || p === 'high') return 'HIGH';
  if (p === 'medium') return 'MEDIUM';
  return 'LOW';
}

function stripAdf(description: unknown): string {
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
      await prisma.ticket.upsert({
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
    }
  }

  await prisma.jiraConfig.update({
    where: { orgId },
    data: { lastSyncAt: new Date() },
  });
}

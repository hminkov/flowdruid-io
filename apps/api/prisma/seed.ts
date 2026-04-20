// apps/api/prisma/seed.ts
//
// Seed data for Flowdruid — Cloudruid internal team.
// Four business teams: Deposit/Withdrawal, Exchange, Account, QA.
// All user passwords are "Password123!" (hashed with bcryptjs cost 10).

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const today = new Date();
today.setHours(0, 0, 0, 0);

const daysFromToday = (n: number): Date => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

const hoursAgo = (h: number): Date => {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d;
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
};

async function main() {
  console.log('Seeding Cloudruid workspace...');

  await prisma.coverRequest.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.assignmentSuggestion.deleteMany();
  await prisma.ticketAssignment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.standup.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.slackConfig.deleteMany();
  await prisma.jiraConfig.deleteMany();
  await prisma.parkingAssignment.deleteMany();
  await prisma.parkingSpot.deleteMany();
  await prisma.qaBooking.deleteMany();
  await prisma.qaEnvironment.deleteMany();
  await prisma.prodSupportAssignment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.organisation.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const org = await prisma.organisation.create({
    data: { name: 'Cloudruid', slug: 'cloudruid' },
  });

  const depositTeam = await prisma.team.create({
    data: { name: 'Deposit / Withdrawal', orgId: org.id, slackChannelId: 'C01DEP00001' },
  });
  const exchangeTeam = await prisma.team.create({
    data: { name: 'Exchange', orgId: org.id, slackChannelId: 'C01EXC00002' },
  });
  const accountTeam = await prisma.team.create({
    data: { name: 'Account', orgId: org.id, slackChannelId: 'C01ACC00003' },
  });
  const qaTeam = await prisma.team.create({
    data: { name: 'QA', orgId: org.id, slackChannelId: 'C01QA000004' },
  });

  type Seed = {
    name: string;
    email: string;
    role: 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';
    teamId: string | null;
    availability: 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';
  };

  const seeds: Seed[] = [
    // CEO
    { name: 'Borislav Shekerov', email: 'borislav.shekerov@cloudruid.com', role: 'ADMIN', teamId: null, availability: 'AVAILABLE' },

    // Admin (user)
    { name: 'Hristo Minkov', email: 'hristo.minkov@cloudruid.com', role: 'ADMIN', teamId: depositTeam.id, availability: 'AVAILABLE' },

    // Deposit / Withdrawal
    { name: 'Krasimir Gizdov', email: 'krasimir.gizdov@cloudruid.com', role: 'TEAM_LEAD', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Borislav Iliev', email: 'borislav.iliev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'BUSY' },
    { name: 'Dimitar Dimitrov', email: 'dimitar.dimitrov@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivan Backrachev', email: 'ivan.backrachev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'REMOTE' },
    { name: 'Elitsa Stancheva', email: 'elitsa.stancheva@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivan Borisov', email: 'ivan.borisov@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Tihomir Evgeniev', email: 'tihomir.evgeniev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'BUSY' },
    { name: 'Dimitar Kolev', email: 'dimitar.kolev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Dimitar Tagarev', email: 'dimitar.tagarev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'REMOTE' },
    { name: 'Marian Valchinov', email: 'marian.valchinov@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Renal Ahmedov', email: 'renal.ahmedov@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'REMOTE' },
    { name: 'Teodor Karakashev', email: 'teodor.karakashev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Nikola Valchinov', email: 'nikola.valchinov@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'BUSY' },
    { name: 'Veselin Velev', email: 'veselin.velev@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },
    { name: 'Boris', email: 'boris@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'ON_LEAVE' },

    // Exchange
    { name: 'Ivaylo Hadzhiyski', email: 'ivaylo.hadzhiyski@cloudruid.com', role: 'TEAM_LEAD', teamId: exchangeTeam.id, availability: 'AVAILABLE' },
    { name: 'Panayot Kostov', email: 'panayot.kostov@cloudruid.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'AVAILABLE' },
    { name: 'Ralitsa Stancheva', email: 'ralitsa.stancheva@cloudruid.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'BUSY' },
    { name: 'Radoslav Dimitrov', email: 'radoslav.dimitrov@cloudruid.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'AVAILABLE' },

    // Account
    { name: 'Svetoslav Kochev', email: 'svetoslav.kochev@cloudruid.com', role: 'TEAM_LEAD', teamId: accountTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivo Iliev', email: 'ivo.iliev@cloudruid.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'AVAILABLE' },
    { name: 'Todor Kanev', email: 'todor.kanev@cloudruid.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'REMOTE' },
    { name: 'Keti Hambarliyska', email: 'keti.hambarliyska@cloudruid.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'AVAILABLE' },

    // QA
    { name: 'Ivelina Georgieva', email: 'ivelina.georgieva@cloudruid.com', role: 'TEAM_LEAD', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Diana Demireva', email: 'diana.demireva@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Veronika Kashaykova', email: 'veronika.kashaykova@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Yuliia Pylaieva', email: 'yuliia.pylaieva@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'ON_LEAVE' },
    { name: 'Momchil Dimitrov', email: 'momchil.dimitrov@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
  ];

  const users: Record<string, { id: string; name: string }> = {};
  for (const s of seeds) {
    const u = await prisma.user.create({
      data: {
        email: s.email,
        name: s.name,
        initials: initialsOf(s.name),
        passwordHash,
        role: s.role,
        orgId: org.id,
        teamId: s.teamId,
        availability: s.availability,
      },
    });
    users[s.email] = u;
  }

  const id = (email: string) => users[email]!.id;

  const hristo = id('hristo.minkov@cloudruid.com');
  const krasimir = id('krasimir.gizdov@cloudruid.com');
  const borislav = id('borislav.iliev@cloudruid.com');
  const dimitar = id('dimitar.dimitrov@cloudruid.com');
  const ivan = id('ivan.backrachev@cloudruid.com');
  const ivayloH = id('ivaylo.hadzhiyski@cloudruid.com');
  const panayot = id('panayot.kostov@cloudruid.com');
  const elitsa = id('elitsa.stancheva@cloudruid.com');
  const ralitsa = id('ralitsa.stancheva@cloudruid.com');
  const svetli = id('svetoslav.kochev@cloudruid.com');
  const ivayloI = id('ivo.iliev@cloudruid.com');
  const todor = id('todor.kanev@cloudruid.com');
  const ivelina = id('ivelina.georgieva@cloudruid.com');
  const diana = id('diana.demireva@cloudruid.com');
  const veronika = id('veronika.kashaykova@cloudruid.com');
  const yuliia = id('yuliia.pylaieva@cloudruid.com');
  const momchil = id('momchil.dimitrov@cloudruid.com');

  // Extra members pulled in to back the Resources seeds (parking, QA, prod-support)
  const tihomir = id('tihomir.evgeniev@cloudruid.com');
  const marian = id('marian.valchinov@cloudruid.com');
  const renal = id('renal.ahmedov@cloudruid.com');
  const teodor = id('teodor.karakashev@cloudruid.com');
  const nikola = id('nikola.valchinov@cloudruid.com');
  const veselin = id('veselin.velev@cloudruid.com');
  const boris = id('boris@cloudruid.com');
  const keti = id('keti.hambarliyska@cloudruid.com');
  const radoslav = id('radoslav.dimitrov@cloudruid.com');
  const ivanBorisov = id('ivan.borisov@cloudruid.com');
  const dimitarKolev = id('dimitar.kolev@cloudruid.com');
  const dimitarTagarev = id('dimitar.tagarev@cloudruid.com');

  // ─── TICKETS — Deposit / Withdrawal ─────────────────────────────────────
  const dw1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-041',
      jiraId: '10041',
      title: 'SEPA withdrawal — retry on bank timeout',
      description: 'Outbound SEPA calls time out occasionally; implement exponential backoff with idempotency.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw1.id, userId: borislav } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw1.id, userId: dimitar } });

  const dw2 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-042',
      jiraId: '10042',
      title: 'Crypto deposit — confirmations below threshold',
      description: 'Edge: deposits credited before required confirmations when node reports stale head.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw2.id, userId: krasimir } });

  const dw3 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-038',
      jiraId: '10038',
      title: 'Withdrawal limits — daily cap per currency',
      description: 'Apply per-currency daily caps and surface the remaining amount in the UI.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw3.id, userId: ivan } });

  await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Runbook — stuck deposit remediation',
      description: 'Document the triage and manual-credit flow for stuck deposits.',
      status: 'TODO',
      priority: 'LOW',
      teamId: depositTeam.id,
    },
  });

  // ─── TICKETS — Exchange ─────────────────────────────────────────────────
  const ex1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-017',
      jiraId: '20017',
      title: 'Order book — partial fill UX',
      description: 'Show partial fills as they happen instead of only on order close.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex1.id, userId: ivayloH } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex1.id, userId: panayot } });

  const ex2 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-018',
      jiraId: '20018',
      title: 'Pair listings — config hot reload',
      description: 'Reload pair configuration without a service restart.',
      status: 'TODO',
      priority: 'MEDIUM',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex2.id, userId: ralitsa } });

  // ─── TICKETS — Account ──────────────────────────────────────────────────
  const ac1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-022',
      jiraId: '30022',
      title: 'KYC refresh — expiring documents reminder',
      description: 'Email users 14 days before their document expires; retry at 7 and 1 days.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac1.id, userId: svetli } });

  const ac2 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-023',
      jiraId: '30023',
      title: '2FA recovery flow rewrite',
      description: 'Replace the current recovery email flow with signed recovery codes.',
      status: 'IN_REVIEW',
      priority: 'HIGH',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac2.id, userId: ivayloI } });
  await prisma.ticketAssignment.create({ data: { ticketId: ac2.id, userId: todor } });

  // ─── TICKETS — QA ───────────────────────────────────────────────────────
  const qa1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-015',
      jiraId: '40015',
      title: 'Regression suite — flaky withdrawal tests',
      description: '3 tests flake intermittently when the worker queue is saturated.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa1.id, userId: ivelina } });

  const qa2 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-016',
      jiraId: '40016',
      title: 'Exchange — load test 10× current peak',
      description: 'Simulate 10× peak order volume and record p95/p99 latencies.',
      status: 'TODO',
      priority: 'HIGH',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa2.id, userId: diana } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa2.id, userId: momchil } });

  const qa3 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Smoke tests — add to CI main branch',
      status: 'IN_REVIEW',
      priority: 'LOW',
      teamId: qaTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa3.id, userId: veronika } });

  // ─── MORE TICKETS — Deposit / Withdrawal ────────────────────────────────
  const dw5 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-045',
      jiraId: '10045',
      title: 'Webhook signature verification — PSP payloads',
      description: 'Verify HMAC on every inbound PSP webhook. Reject unsigned or stale payloads.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw5.id, userId: borislav } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw5.id, userId: ivan } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw5.id, userId: elitsa } });

  const dw6 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-046',
      jiraId: '10046',
      title: 'Withdrawal fee calculator refactor',
      description: 'Extract fee rules into a config table and add per-tier overrides.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw6.id, userId: dimitar } });

  const dw7 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-044',
      jiraId: '10044',
      title: 'USD wire deposits — SWIFT integration',
      description: 'Connect to partner bank SWIFT endpoint; parse MT103 inbound messages into deposits.',
      status: 'TODO',
      priority: 'HIGH',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw7.id, userId: krasimir } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw7.id, userId: elitsa } });

  const dw8 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-035',
      jiraId: '10035',
      title: 'Reconciliation report v2 — drill-through',
      description: 'Support per-transaction drill-through from the daily reconciliation report.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw8.id, userId: dimitar } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw8.id, userId: elitsa } });

  const dw9 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-025',
      jiraId: '10025',
      title: 'Audit log — deposit trail',
      description: 'Record every status change on a deposit with actor and source system.',
      status: 'DONE',
      priority: 'LOW',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(30),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw9.id, userId: borislav } });

  const dw10 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Weekly reconciliation runbook',
      description: 'Step-by-step for the weekly Monday reconciliation call.',
      status: 'TODO',
      priority: 'LOW',
      teamId: depositTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw10.id, userId: ivan } });

  const dw11 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Transaction age metric in Grafana',
      description: 'Dashboard showing age of the oldest unresolved deposit per PSP.',
      status: 'TODO',
      priority: 'MEDIUM',
      teamId: depositTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw11.id, userId: krasimir } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw11.id, userId: ivan } });

  const dw12 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-050',
      jiraId: '10050',
      title: 'Payout scheduling — timezone bug',
      description: 'Cron lands at 23:00 UTC instead of local time for non-UTC orgs.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: depositTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw12.id, userId: elitsa } });

  // ─── MORE TICKETS — Exchange ────────────────────────────────────────────
  const ex3 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-020',
      jiraId: '20020',
      title: 'Matching engine — spread validation',
      description: 'Reject orders that cross the spread boundary during auction.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex3.id, userId: ivayloH } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex3.id, userId: panayot } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex3.id, userId: ralitsa } });

  const ex4 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-021',
      jiraId: '20021',
      title: 'WebSocket reconnection jitter',
      description: 'Exponential backoff with jitter so reconnect storms don\'t flood the gateway.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex4.id, userId: panayot } });

  const ex5 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-015',
      jiraId: '20015',
      title: 'Market data feed migration — v2',
      description: 'Cut over feed from Redis pub/sub to NATS JetStream.',
      status: 'TODO',
      priority: 'HIGH',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex5.id, userId: ivayloH } });

  const ex6 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-014',
      jiraId: '20014',
      title: 'Historical candles API',
      description: '1m/5m/1h/1d candles endpoint with cursor pagination.',
      status: 'DONE',
      priority: 'LOW',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(48),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex6.id, userId: ralitsa } });

  const ex7 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Pre-market checklist automation',
      description: 'Automate the 7am pre-market sanity-check run.',
      status: 'TODO',
      priority: 'MEDIUM',
      teamId: exchangeTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex7.id, userId: panayot } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex7.id, userId: ralitsa } });

  const ex8 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'EX-022',
      jiraId: '20022',
      title: 'Self-match prevention',
      description: 'Block orders that would match a resting order from the same account.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: exchangeTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ex8.id, userId: ivayloH } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex8.id, userId: ralitsa } });

  // ─── MORE TICKETS — Account ─────────────────────────────────────────────
  const ac3 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-024',
      jiraId: '30024',
      title: 'Email verification — link expiry tuning',
      description: 'Reduce link expiry from 7d to 24h; add in-product resend.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac3.id, userId: svetli } });

  const ac4 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-025',
      jiraId: '30025',
      title: 'Profile photo upload',
      description: 'S3 signed URL flow, square crop, max 5 MB.',
      status: 'TODO',
      priority: 'LOW',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac4.id, userId: ivayloI } });

  const ac5 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-026',
      jiraId: '30026',
      title: 'Session timeout for inactive users',
      description: 'Log out idle sessions after 30 minutes; warn at 25.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac5.id, userId: todor } });

  const ac6 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-020',
      jiraId: '30020',
      title: 'Sign-up flow — captcha for suspicious IPs',
      description: 'Surface hCaptcha when the IP fails reputation checks.',
      status: 'DONE',
      priority: 'HIGH',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(72),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac6.id, userId: svetli } });
  await prisma.ticketAssignment.create({ data: { ticketId: ac6.id, userId: ivayloI } });

  const ac7 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Account deletion — GDPR runbook',
      description: 'Legal-approved steps for handling right-to-erasure requests.',
      status: 'TODO',
      priority: 'LOW',
      teamId: accountTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac7.id, userId: svetli } });

  const ac8 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'AC-027',
      jiraId: '30027',
      title: 'Referral code generator',
      description: 'Unique 8-char codes, per-user rate limits, opt-in attribution.',
      status: 'TODO',
      priority: 'LOW',
      teamId: accountTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: ac8.id, userId: todor } });

  // ─── MORE TICKETS — QA ──────────────────────────────────────────────────
  const qa4 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-017',
      jiraId: '40017',
      title: 'E2E harness — cross-team flows',
      description: 'Playwright suite that covers deposit → exchange → withdrawal.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa4.id, userId: ivelina } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa4.id, userId: diana } });

  const qa5 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-018',
      jiraId: '40018',
      title: 'Visual regression on tasks board',
      description: 'Chromatic baseline for the kanban and key UI states.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa5.id, userId: veronika } });

  const qa6 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-019',
      jiraId: '40019',
      title: 'Performance baseline — dashboard load',
      description: 'Measure p50/p95/p99 load time; lock in thresholds.',
      status: 'TODO',
      priority: 'MEDIUM',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa6.id, userId: momchil } });

  const qa7 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-020',
      jiraId: '40020',
      title: 'Accessibility audit — WCAG 2.1 AA',
      description: 'Run axe across every page; log and prioritise violations.',
      status: 'TODO',
      priority: 'LOW',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa7.id, userId: diana } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa7.id, userId: veronika } });

  const qa8 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Rotate test data weekly',
      description: 'Refresh staging fixtures every Monday before the retro.',
      status: 'TODO',
      priority: 'LOW',
      teamId: qaTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa8.id, userId: yuliia } });

  const qa9 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'QA-013',
      jiraId: '40013',
      title: 'Security test — token rotation',
      description: 'Verify every access token is invalidated when a refresh token rotates.',
      status: 'DONE',
      priority: 'HIGH',
      teamId: qaTeam.id,
      syncedAt: hoursAgo(48),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa9.id, userId: momchil } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa9.id, userId: ivelina } });

  const qa10 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Test plan template',
      description: 'Standard template to attach to every feature ticket.',
      status: 'TODO',
      priority: 'LOW',
      teamId: qaTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa10.id, userId: ivelina } });

  // ─── STANDUPS — today ───────────────────────────────────────────────────
  await prisma.standup.create({
    data: {
      userId: krasimir,
      teamId: depositTeam.id,
      yesterday: 'Release planning, coordinated SEPA retry spec with Borislav and Dimitar.',
      today: 'DW-042 triage. Available for questions.',
      blockers: null,
      capacityPct: 60,
      postedAt: hoursAgo(6),
    },
  });

  await prisma.standup.create({
    data: {
      userId: borislav,
      teamId: depositTeam.id,
      yesterday: 'Idempotency keys for SEPA retries.',
      today: 'Continuing DW-041. Full day — no capacity for new tasks.',
      blockers: 'Need staging DB dump refreshed — @Krasimir',
      capacityPct: 95,
      postedAt: hoursAgo(5),
    },
  });

  await prisma.standup.create({
    data: {
      userId: dimitar,
      teamId: depositTeam.id,
      yesterday: 'SEPA retry PR reviewed; added test coverage.',
      today: 'Pairing with Borislav on DW-041. Some capacity for reviews.',
      blockers: null,
      capacityPct: 70,
      postedAt: hoursAgo(4),
    },
  });

  await prisma.standup.create({
    data: {
      userId: ivan,
      teamId: depositTeam.id,
      yesterday: 'DW-038 cap enforcement done; PR up for review.',
      today: 'Remote today. Responding to review comments.',
      blockers: null,
      capacityPct: 50,
      postedAt: hoursAgo(3),
    },
  });

  await prisma.standup.create({
    data: {
      userId: ivayloH,
      teamId: exchangeTeam.id,
      yesterday: 'Planning partial fill UX with Panayot.',
      today: 'Implementing incremental fill events on EX-017.',
      blockers: null,
      capacityPct: 70,
      postedAt: hoursAgo(3),
    },
  });

  await prisma.standup.create({
    data: {
      userId: ivelina,
      teamId: qaTeam.id,
      yesterday: 'Investigated flaky withdrawal tests — suspect is queue backpressure.',
      today: 'Reproducing QA-015 under load; assigning fixtures to Momchil.',
      blockers: null,
      capacityPct: 60,
      postedAt: hoursAgo(2),
    },
  });

  await prisma.standup.create({
    data: {
      userId: svetli,
      teamId: accountTeam.id,
      yesterday: 'Specced out 2FA recovery codes.',
      today: 'KYC reminder job — schedule and copy review.',
      blockers: null,
      capacityPct: 55,
      postedAt: hoursAgo(2),
    },
  });

  // Yesterday
  const yesterday = daysFromToday(-1);
  await prisma.standup.create({
    data: {
      userId: krasimir,
      teamId: depositTeam.id,
      yesterday: 'Client call, architecture review for Q3.',
      today: 'Release coordination, onboarding Ivan to the payouts flow.',
      blockers: null,
      capacityPct: 55,
      postedAt: new Date(yesterday.getTime() + 9.5 * 3600 * 1000),
    },
  });
  await prisma.standup.create({
    data: {
      userId: borislav,
      teamId: depositTeam.id,
      yesterday: 'Backlog grooming, Jira cleanup.',
      today: 'Starting on SEPA retries with Dimitar.',
      blockers: null,
      capacityPct: 80,
      postedAt: new Date(yesterday.getTime() + 9.3 * 3600 * 1000),
    },
  });

  // ─── LEAVES ─────────────────────────────────────────────────────────────
  // Yuliia currently on annual leave
  await prisma.leaveRequest.create({
    data: {
      userId: yuliia,
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: daysFromToday(-2),
      endDate: daysFromToday(2),
      note: 'Pre-planned family trip.',
      reviewedBy: ivelina,
      reviewedAt: daysFromToday(-10),
      notifySlack: true,
    },
  });

  // Ivan remote day today
  await prisma.leaveRequest.create({
    data: {
      userId: ivan,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: today,
      endDate: today,
      reviewedBy: krasimir,
      reviewedAt: daysFromToday(-3),
      notifySlack: true,
    },
  });

  // Borislav partial day last week
  await prisma.leaveRequest.create({
    data: {
      userId: borislav,
      type: 'PARTIAL_PM',
      status: 'APPROVED',
      startDate: daysFromToday(-7),
      endDate: daysFromToday(-7),
      note: 'Doctor appointment.',
      reviewedBy: krasimir,
      reviewedAt: daysFromToday(-9),
    },
  });

  // PENDING — Elitsa partial day
  await prisma.leaveRequest.create({
    data: {
      userId: elitsa,
      type: 'PARTIAL_AM',
      status: 'PENDING',
      startDate: daysFromToday(2),
      endDate: daysFromToday(2),
      note: 'Dentist in the morning.',
      notifySlack: true,
    },
  });

  // PENDING — Dimitar annual leave
  await prisma.leaveRequest.create({
    data: {
      userId: dimitar,
      type: 'ANNUAL',
      status: 'PENDING',
      startDate: daysFromToday(6),
      endDate: daysFromToday(8),
      note: 'Long weekend away.',
      notifySlack: true,
    },
  });

  // PENDING — Todor remote day
  await prisma.leaveRequest.create({
    data: {
      userId: todor,
      type: 'REMOTE',
      status: 'PENDING',
      startDate: daysFromToday(13),
      endDate: daysFromToday(13),
      notifySlack: true,
    },
  });

  // Diana approved remote block
  await prisma.leaveRequest.create({
    data: {
      userId: diana,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: daysFromToday(5),
      endDate: daysFromToday(9),
      note: 'Working from the coast this week.',
      reviewedBy: ivelina,
      reviewedAt: daysFromToday(-1),
    },
  });

  // Future scheduled
  await prisma.leaveRequest.create({
    data: {
      userId: yuliia,
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: daysFromToday(21),
      endDate: daysFromToday(23),
      reviewedBy: ivelina,
      reviewedAt: daysFromToday(-5),
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: krasimir,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: daysFromToday(27),
      endDate: daysFromToday(28),
      reviewedBy: hristo,
      reviewedAt: daysFromToday(-2),
    },
  });

  // ─── INTEGRATIONS (placeholders) ────────────────────────────────────────
  await prisma.slackConfig.create({
    data: {
      orgId: org.id,
      botToken: 'xoxb-PLACEHOLDER-REPLACE-VIA-UI',
      signingSecret: 'PLACEHOLDER-REPLACE-VIA-UI',
      notifyStandup: true,
      notifyLeave: true,
      notifyBlocker: true,
      notifyDone: false,
      notifyBroadcast: true,
    },
  });

  await prisma.jiraConfig.create({
    data: {
      orgId: org.id,
      baseUrl: 'https://cloudruid.atlassian.net',
      email: 'hristo.minkov@cloudruid.com',
      apiToken: 'PLACEHOLDER-REPLACE-VIA-UI',
      projectKeys: ['DW', 'EX', 'AC', 'QA'],
      syncInterval: 15,
      lastSyncAt: hoursAgo(1),
    },
  });

  // ─── PARKING SPOTS + ASSIGNMENTS ─────────────────────────────────────────
  const parkingSpotIds: Record<string, string> = {};
  for (let i = 1; i <= 7; i++) {
    const name = `Spot ${i}`;
    const spot = await prisma.parkingSpot.create({
      data: { orgId: org.id, name, order: i },
    });
    parkingSpotIds[name] = spot.id;
  }

  // Build two Mon-Fri weeks: the current week (containing "today") and the previous one.
  const mondayOf = (d: Date) => {
    const x = new Date(d);
    const day = x.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setUTCDate(x.getUTCDate() + diff);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  };
  const thisMonday = mondayOf(today);
  const parkingWeeks: Date[] = [];
  for (let offset = -7; offset <= 0; offset += 7) {
    const m = new Date(thisMonday);
    m.setUTCDate(m.getUTCDate() + offset);
    parkingWeeks.push(m);
  }

  const rotation = [
    [krasimir, ivayloH, svetli, ivelina, panayot, tihomir, marian],
    [hristo, panayot, svetli, radoslav, borislav, renal, marian],
    [krasimir, ivayloH, svetli, ivelina, teodor, tihomir, veselin],
    [hristo, panayot, ivan, keti, dimitar, nikola, boris],
    [krasimir, ivayloH, svetli, ivelina, ivanBorisov, tihomir, marian],
  ] as const;

  for (let wi = 0; wi < parkingWeeks.length; wi++) {
    const monday = parkingWeeks[wi]!;
    for (let day = 0; day < 5; day++) {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() + day);
      const assignments = rotation[day]!;
      for (let spotIdx = 0; spotIdx < 7; spotIdx++) {
        await prisma.parkingAssignment.create({
          data: {
            spotId: parkingSpotIds[`Spot ${spotIdx + 1}`]!,
            userId: assignments[spotIdx]!,
            date: d,
          },
        });
      }
    }
  }

  // ─── QA ENVIRONMENTS + BOOKINGS ──────────────────────────────────────────
  const envNames = ['QA1', 'QA2', 'QA3', 'QA4', 'QA5', 'QA6', 'QA7', 'QA8', 'QA9', 'QA10', 'QA11', 'STG', 'BETA'];
  const envIds: Record<string, string> = {};
  for (let i = 0; i < envNames.length; i++) {
    const e = await prisma.qaEnvironment.create({
      data: { orgId: org.id, name: envNames[i]!, order: i },
    });
    envIds[envNames[i]!] = e.id;
  }

  const qaBookings = [
    { env: 'QA1', service: 'Account management', feature: 'Gateway 21 project', devOwnerId: renal, qaOwnerId: diana, status: 'IN_DEVELOPMENT', notes: 'Phase 2', branch: 'temp/qa1-config' },
    { env: 'QA1', service: 'Salesforce integration service', feature: 'Gateway 21 project', devOwnerId: ivanBorisov, qaOwnerId: null, status: 'PAUSED', notes: 'Blocked because of Gateway21', branch: null },
    { env: 'QA2', service: 'Exchange services', feature: 'Health check endpoint', devOwnerId: panayot, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null, branch: 'qa2-config-v2' },
    { env: 'QA2', service: 'withdrawal services', feature: 'Migrate to new Fireblocks SDK', devOwnerId: borislav, qaOwnerId: null, status: 'PAUSED', notes: null, branch: null },
    { env: 'QA2', service: 'account services', feature: 'Email MFA', devOwnerId: borislav, qaOwnerId: diana, status: 'IN_DEVELOPMENT', notes: 'Released V1', branch: null },
    { env: 'QA3', service: 'Fiat deposit processing', feature: 'Fraud Questionnaire', devOwnerId: elitsa, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null, branch: 'feature/fraud-questionnaire' },
    { env: 'QA3', service: 'Exchange', feature: 'Maintenance guard', devOwnerId: panayot, qaOwnerId: panayot, status: 'IN_DEVELOPMENT', notes: null, branch: null },
    { env: 'QA4', service: 'Merchant services', feature: 'Merchant V2 Dashboard', devOwnerId: radoslav, qaOwnerId: null, status: 'TEST_IN_QA', notes: null, branch: 'qa4-config' },
    { env: 'QA4', service: 'Account', feature: 'MFA improvements', devOwnerId: ivayloI, qaOwnerId: yuliia, status: 'TEST_IN_QA', notes: null, branch: null },
    { env: 'QA5', service: 'Account management', feature: 'KYB backfilling + account closure', devOwnerId: radoslav, qaOwnerId: null, status: 'TEST_IN_QA', notes: null, branch: null },
    { env: 'QA5', service: 'KMS', feature: 'KYB backfilling', devOwnerId: tihomir, qaOwnerId: null, status: 'TEST_IN_QA', notes: null, branch: null },
    { env: 'QA6', service: 'Yield engine', feature: 'Automate yield payments push', devOwnerId: keti, qaOwnerId: keti, status: 'TEST_IN_QA', notes: null, branch: 'qa6-config' },
    { env: 'QA6', service: 'Account', feature: 'T&C', devOwnerId: svetli, qaOwnerId: yuliia, status: 'PUSHED_TO_PROD', notes: null, branch: null },
    { env: 'QA7', service: 'Withdrawal-api', feature: 'Payments v2', devOwnerId: boris, qaOwnerId: boris, status: 'TEST_IN_QA', notes: null, branch: 'payments-v2' },
    { env: 'QA8', service: 'Fiat deposit services', feature: 'Yellowcard Phase 2.1', devOwnerId: dimitar, qaOwnerId: momchil, status: 'READY_FOR_PROD', notes: null, branch: 'feature/new-deposit-queues' },
    { env: 'QA9', service: 'Account', feature: 'New IP email', devOwnerId: svetli, qaOwnerId: ivelina, status: 'READY_FOR_PROD', notes: 'Request from Tom', branch: null },
    { env: 'QA9', service: 'profit-and-loss-processor', feature: 'New service', devOwnerId: todor, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null, branch: null },
    { env: 'QA10', service: 'Debit card payment processing', feature: 'Chargebacks', devOwnerId: teodor, qaOwnerId: yuliia, status: 'IN_DEVELOPMENT', notes: null, branch: null },
    { env: 'QA10', service: 'Exchange', feature: 'Order amendment fix', devOwnerId: ralitsa, qaOwnerId: diana, status: 'TEST_IN_QA', notes: null, branch: null },
    { env: 'STG', service: 'Kinesis test automation', feature: 'Crypto deposit/withdrawal email MFA', devOwnerId: momchil, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null, branch: 'patch/stg-config' },
    { env: 'BETA', service: 'KMS - BETA', feature: 'CoinWatch V1 - review', devOwnerId: ivayloH, qaOwnerId: ivelina, status: 'TEST_IN_QA', notes: null, branch: null },
  ] as const;

  for (const b of qaBookings) {
    await prisma.qaBooking.create({
      data: {
        environmentId: envIds[b.env]!,
        service: b.service,
        feature: b.feature,
        devOwnerId: b.devOwnerId,
        qaOwnerId: b.qaOwnerId,
        status: b.status,
        notes: b.notes,
        branch: b.branch,
      },
    });
  }

  // ─── PROD SUPPORT ROTA (per team, 10 upcoming weeks) ──────────────────────
  // Weekly pair starting on Monday.  Seeded for every team so leads can see the schedule.
  const mondayUtc = (d: Date) => {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    const day = x.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setUTCDate(x.getUTCDate() + diff);
    return x;
  };
  const isoWeekNumber = (d: Date): number => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (t.getUTCDay() + 6) % 7;
    t.setUTCDate(t.getUTCDate() - dayNum + 3);
    const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    const firstThuDayNum = (firstThu.getUTCDay() + 6) % 7;
    firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDayNum + 3);
    return 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000));
  };

  type Pair = [string, string];
  const rotas: { teamId: string; pairs: Pair[] }[] = [
    {
      teamId: depositTeam.id,
      pairs: [
        [dimitar, krasimir],
        [hristo, ivan],
        [borislav, dimitar],
        [krasimir, elitsa],
        [hristo, borislav],
        [krasimir, ivan],
        [elitsa, dimitar],
        [hristo, krasimir],
        [ivan, dimitar],
        [elitsa, borislav],
      ],
    },
    {
      teamId: exchangeTeam.id,
      pairs: [
        [ivayloH, panayot],
        [panayot, ralitsa],
        [ivayloH, radoslav],
        [panayot, ivayloH],
        [ralitsa, radoslav],
        [ivayloH, panayot],
        [panayot, ralitsa],
        [ivayloH, radoslav],
        [panayot, ralitsa],
        [ivayloH, panayot],
      ],
    },
    {
      teamId: accountTeam.id,
      pairs: [
        [svetli, ivayloI],
        [ivayloI, todor],
        [svetli, keti],
        [todor, keti],
        [svetli, ivayloI],
        [ivayloI, todor],
        [svetli, keti],
        [todor, svetli],
        [ivayloI, keti],
        [svetli, todor],
      ],
    },
    {
      teamId: qaTeam.id,
      pairs: [
        [ivelina, diana],
        [diana, veronika],
        [ivelina, momchil],
        [veronika, diana],
        [momchil, ivelina],
        [ivelina, veronika],
        [diana, momchil],
        [veronika, ivelina],
        [momchil, diana],
        [ivelina, diana],
      ],
    },
  ];

  // ─── NOTIFICATIONS (demo feed) ──────────────────────────────────────────
  // A mixed bag so the inbox has mentions, actions, and passive reads.
  const notify = async (data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    linkPath?: string;
    actorId?: string;
    entityId?: string;
    hoursAgo?: number;
    read?: boolean;
  }) => {
    const createdAt = data.hoursAgo != null ? hoursAgo(data.hoursAgo) : new Date();
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as
          | 'LEAVE_APPROVED'
          | 'LEAVE_DENIED'
          | 'LEAVE_PENDING'
          | 'BLOCKER_ON_TEAM'
          | 'TICKET_SUGGESTED'
          | 'TICKET_ASSIGNED'
          | 'TICKET_STATUS'
          | 'STANDUP_MENTION'
          | 'PROD_SUPPORT_ON_CALL'
          | 'GENERIC',
        title: data.title,
        body: data.body,
        linkPath: data.linkPath,
        actorId: data.actorId,
        entityId: data.entityId,
        read: data.read ?? false,
        createdAt,
      },
    });
  };

  // Hristo (admin)
  await notify({
    userId: hristo,
    type: 'LEAVE_PENDING',
    title: 'Pending leave requests',
    body: 'Krasimir has 3 leave requests waiting for approval.',
    linkPath: '/admin/leaves',
    actorId: krasimir,
    hoursAgo: 2,
  });
  await notify({
    userId: hristo,
    type: 'BLOCKER_ON_TEAM',
    title: 'Blocker flagged by Borislav',
    body: 'Need staging DB dump refreshed — tagged @Krasimir',
    linkPath: '/standup',
    actorId: borislav,
    hoursAgo: 5,
  });
  await notify({
    userId: hristo,
    type: 'GENERIC',
    title: 'Welcome to Flowdruid!',
    body: 'Explore the dashboard, task board, and leave calendar.',
    hoursAgo: 48,
    read: true,
  });

  // Krasimir (lead)
  await notify({
    userId: krasimir,
    type: 'LEAVE_PENDING',
    title: '3 leave requests to review',
    body: 'Elitsa, Dimitar, and Todor are waiting.',
    linkPath: '/admin/leaves',
    hoursAgo: 3,
  });
  await notify({
    userId: krasimir,
    type: 'TICKET_SUGGESTED',
    title: 'Borislav suggested you for a ticket',
    body: 'CR-042 — Client publish — repo update',
    linkPath: '/t/placeholder',
    actorId: borislav,
    hoursAgo: 1,
  });
  await notify({
    userId: krasimir,
    type: 'PROD_SUPPORT_ON_CALL',
    title: "You're on call this week",
    body: 'Deposit / Withdrawal team — primary this week.',
    linkPath: '/prod-support',
    hoursAgo: 24,
  });

  // Borislav
  await notify({
    userId: borislav,
    type: 'TICKET_ASSIGNED',
    title: 'Dimitar assigned you to DW-045',
    body: 'Webhook signature verification',
    linkPath: '/tasks',
    actorId: dimitar,
    hoursAgo: 6,
  });
  await notify({
    userId: borislav,
    type: 'STANDUP_MENTION',
    title: 'Krasimir mentioned you in standup',
    body: 'Pairing on fiat deposit processing today.',
    linkPath: '/standup',
    actorId: krasimir,
    hoursAgo: 7,
  });

  // Elitsa
  await notify({
    userId: elitsa,
    type: 'LEAVE_APPROVED',
    title: 'Your leave request was approved',
    body: 'Partial AM on Wednesday — enjoy the dentist visit.',
    linkPath: '/leave/request',
    actorId: krasimir,
    hoursAgo: 4,
  });

  // Dimitar
  await notify({
    userId: dimitar,
    type: 'TICKET_STATUS',
    title: 'CR-033 moved to Done',
    body: 'Auth token refresh edge case closed.',
    linkPath: '/tasks',
    hoursAgo: 26,
    read: true,
  });

  // Ivelina (QA lead)
  await notify({
    userId: ivelina,
    type: 'LEAVE_PENDING',
    title: 'Yuliia requested annual leave',
    body: 'Review on /admin/leaves',
    linkPath: '/admin/leaves',
    actorId: yuliia,
    hoursAgo: 3,
  });

  // Svetli (Account lead)
  await notify({
    userId: svetli,
    type: 'TICKET_SUGGESTED',
    title: 'Hristo suggested you for AC-024',
    body: 'Email verification — link expiry tuning',
    linkPath: '/t/placeholder',
    actorId: hristo,
    hoursAgo: 8,
  });

  // ─── MESSAGING (team channels + sample DMs) ──────────────────────────────
  // One channel per team, every team member joined. A few recent messages each.
  const teamChannels: { teamId: string; members: string[]; name: string }[] = [
    {
      teamId: depositTeam.id,
      name: 'Deposit / Withdrawal',
      members: [
        hristo, krasimir, borislav, dimitar, ivan, elitsa, ivanBorisov, tihomir,
        dimitarKolev, dimitarTagarev, marian, renal, teodor, nikola, veselin, boris,
      ],
    },
    {
      teamId: exchangeTeam.id,
      name: 'Exchange',
      members: [ivayloH, panayot, ralitsa, radoslav],
    },
    {
      teamId: accountTeam.id,
      name: 'Account',
      members: [svetli, ivayloI, todor, keti],
    },
    {
      teamId: qaTeam.id,
      name: 'QA',
      members: [ivelina, diana, veronika, yuliia, momchil],
    },
  ];

  for (const ch of teamChannels) {
    const conv = await prisma.conversation.create({
      data: {
        orgId: org.id,
        kind: 'TEAM_CHANNEL',
        teamId: ch.teamId,
        name: ch.name,
      },
    });
    for (const memberId of ch.members) {
      await prisma.conversationMember.create({
        data: { conversationId: conv.id, userId: memberId },
      });
    }
  }

  // Seed a handful of messages in the Deposit / Withdrawal channel
  const dwChannel = await prisma.conversation.findFirst({
    where: { teamId: depositTeam.id, kind: 'TEAM_CHANNEL' },
  });
  if (dwChannel) {
    const msgs: { authorId: string; body: string; minutesAgo: number }[] = [
      { authorId: krasimir, body: 'Morning team — SEPA retry lands today, heads up.', minutesAgo: 180 },
      { authorId: borislav, body: 'Blocked on staging DB dump — @Krasi can you refresh?', minutesAgo: 150 },
      { authorId: krasimir, body: 'Refreshed. You should be unblocked now.', minutesAgo: 140 },
      { authorId: dimitar, body: 'Will review DW-045 this afternoon', minutesAgo: 90 },
      { authorId: ivan, body: 'Remote today. Coffee is over-engineered.', minutesAgo: 60 },
      { authorId: borislav, body: 'Thanks ✅ Pushed the fix.', minutesAgo: 20 },
    ];
    for (const m of msgs) {
      await prisma.message.create({
        data: {
          conversationId: dwChannel.id,
          authorId: m.authorId,
          body: m.body,
          createdAt: new Date(Date.now() - m.minutesAgo * 60_000),
        },
      });
    }
    // Mark Krasimir's last read as now (so he sees unread count 0), leave others as null (unread)
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: dwChannel.id, userId: krasimir } },
      data: { lastReadAt: new Date() },
    });
  }

  // Sample DM: Hristo ↔ Krasimir
  const dm = await prisma.conversation.create({
    data: {
      orgId: org.id,
      kind: 'DM',
      members: { create: [{ userId: hristo }, { userId: krasimir }] },
    },
  });
  const dmMsgs: { authorId: string; body: string; minutesAgo: number }[] = [
    { authorId: krasimir, body: 'Quick sync on Q3 roadmap tomorrow?', minutesAgo: 240 },
    { authorId: hristo, body: 'Works. 10:00 OK?', minutesAgo: 220 },
    { authorId: krasimir, body: 'Perfect. Will share slides before.', minutesAgo: 210 },
    { authorId: hristo, body: '👍', minutesAgo: 200 },
  ];
  for (const m of dmMsgs) {
    await prisma.message.create({
      data: {
        conversationId: dm.id,
        authorId: m.authorId,
        body: m.body,
        createdAt: new Date(Date.now() - m.minutesAgo * 60_000),
      },
    });
  }

  const baseMonday = mondayUtc(new Date(today));
  // Start 4 weeks back so there is history + future
  baseMonday.setUTCDate(baseMonday.getUTCDate() - 28);
  for (const rota of rotas) {
    for (let i = 0; i < rota.pairs.length; i++) {
      const start = new Date(baseMonday);
      start.setUTCDate(start.getUTCDate() + i * 7);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 4);
      const [primary, secondary] = rota.pairs[i]!;
      await prisma.prodSupportAssignment.create({
        data: {
          teamId: rota.teamId,
          weekNumber: isoWeekNumber(start),
          startDate: start,
          endDate: end,
          primaryId: primary,
          secondaryId: secondary,
        },
      });
    }
  }

  // Demo open cover request so the banner is visible straight after seeding.
  // Pick the Exchange team's current-week shift (primary = Ivaylo Hadzhiyski).
  const currentMonday = mondayUtc(new Date(today));
  const exchangeShift = await prisma.prodSupportAssignment.findUnique({
    where: { teamId_startDate: { teamId: exchangeTeam.id, startDate: currentMonday } },
  });
  if (exchangeShift) {
    const cover = await prisma.coverRequest.create({
      data: {
        assignmentId: exchangeShift.id,
        requesterId: exchangeShift.primaryId,
        reason: 'Doctor appointment blocks the afternoon — looking to swap with someone.',
      },
    });
    // Notify every other active member of the Exchange team
    const teammates = await prisma.user.findMany({
      where: { teamId: exchangeTeam.id, active: true, id: { not: exchangeShift.primaryId } },
      select: { id: true },
    });
    if (teammates.length > 0) {
      await prisma.notification.createMany({
        data: teammates.map((m) => ({
          userId: m.id,
          type: 'PROD_SUPPORT_ON_CALL' as const,
          title: 'Ivaylo Hadzhiyski is looking for cover',
          body: 'Exchange — doctor appointment blocks the afternoon.',
          linkPath: '/prod-support',
          actorId: exchangeShift.primaryId,
          entityId: cover.id,
          createdAt: hoursAgo(2),
        })),
      });
    }
  }

  console.log('Seed complete.');
  console.log(`  Org:       ${org.name}`);
  console.log(`  Teams:     4  (Deposit/Withdrawal, Exchange, Account, QA)`);
  console.log(`  Users:     ${seeds.length}`);
  console.log('');
  console.log('Login credentials — password for all users: Password123!');
  console.log('  Admin:          hristo.minkov@cloudruid.com');
  console.log('  Deposit lead:   krasimir.gizdov@cloudruid.com');
  console.log('  Exchange lead:  ivaylo.hadzhiyski@cloudruid.com');
  console.log('  Account lead:   svetli@cloudruid.com');
  console.log('  QA lead:        ivelina.georgieva@cloudruid.com');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

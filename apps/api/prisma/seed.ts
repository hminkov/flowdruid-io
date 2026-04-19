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

  await prisma.ticketAssignment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.standup.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.slackConfig.deleteMany();
  await prisma.jiraConfig.deleteMany();
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
    { name: 'Ivan', email: 'ivan@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'REMOTE' },
    { name: 'Elitsa Stancheva', email: 'elitsa.stancheva@cloudruid.com', role: 'DEVELOPER', teamId: depositTeam.id, availability: 'AVAILABLE' },

    // Exchange
    { name: 'Ivaylo Hadzhiyski', email: 'ivaylo.hadzhiyski@cloudruid.com', role: 'TEAM_LEAD', teamId: exchangeTeam.id, availability: 'AVAILABLE' },
    { name: 'Panayot', email: 'panayot@cloudruid.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'AVAILABLE' },
    { name: 'Ralitsa Stancheva', email: 'ralitsa.stancheva@cloudruid.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'BUSY' },

    // Account
    { name: 'Svetli', email: 'svetli@cloudruid.com', role: 'TEAM_LEAD', teamId: accountTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivaylo Iliev', email: 'ivaylo.iliev@cloudruid.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'AVAILABLE' },
    { name: 'Todor Kanev', email: 'todor.kanev@cloudruid.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'REMOTE' },

    // QA
    { name: 'Ivelina Georgieva', email: 'ivelina.georgieva@cloudruid.com', role: 'TEAM_LEAD', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Diana Demireva', email: 'diana.demireva@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Veronika Kashaykova', email: 'veronika.kashaykova@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Yuliia', email: 'yuliia@cloudruid.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'ON_LEAVE' },
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
  const ivan = id('ivan@cloudruid.com');
  const ivayloH = id('ivaylo.hadzhiyski@cloudruid.com');
  const panayot = id('panayot@cloudruid.com');
  const elitsa = id('elitsa.stancheva@cloudruid.com');
  const ralitsa = id('ralitsa.stancheva@cloudruid.com');
  const svetli = id('svetli@cloudruid.com');
  const ivayloI = id('ivaylo.iliev@cloudruid.com');
  const todor = id('todor.kanev@cloudruid.com');
  const ivelina = id('ivelina.georgieva@cloudruid.com');
  const diana = id('diana.demireva@cloudruid.com');
  const veronika = id('veronika.kashaykova@cloudruid.com');
  const yuliia = id('yuliia@cloudruid.com');
  const momchil = id('momchil.dimitrov@cloudruid.com');

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

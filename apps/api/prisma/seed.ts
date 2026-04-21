// apps/api/prisma/seed.ts
//
// Seed data for Flowdruid — fictional demo org (Acme).
// Twelve teams matching the sample org chart. Names, emails, and
// org details are all fictional; swap freely for your own fork.
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
  console.log('Seeding Acme demo workspace...');

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
    data: { name: 'Acme', slug: 'acme' },
  });

  // 12 teams from team_members.xlsx. The first xlsx column becomes the team lead.
  const accountTeam = await prisma.team.create({
    data: { name: 'Account', orgId: org.id, slackChannelId: 'C01ACC00001' },
  });
  const yieldTeam = await prisma.team.create({
    data: { name: 'Yield', orgId: org.id, slackChannelId: 'C01YLD00002' },
  });
  const cardPaymentsTeam = await prisma.team.create({
    data: { name: 'Card Payments', orgId: org.id, slackChannelId: 'C01CRD00003' },
  });
  const coinsTeam = await prisma.team.create({
    data: { name: 'Coins — Fiat & Crypto', orgId: org.id, slackChannelId: 'C01CNS00004' },
  });
  const exchangeTeam = await prisma.team.create({
    data: { name: 'Exchange', orgId: org.id, slackChannelId: 'C01EXC00005' },
  });
  const metalbackTeam = await prisma.team.create({
    data: { name: 'Metalback / Cashback', orgId: org.id, slackChannelId: 'C01MTB00006' },
  });
  const kpayTeam = await prisma.team.create({
    data: { name: 'KPay', orgId: org.id, slackChannelId: 'C01KPY00007' },
  });
  const transactionHistoryTeam = await prisma.team.create({
    data: { name: 'Transaction History & Reporting', orgId: org.id, slackChannelId: 'C01THR00008' },
  });
  const mmTeam = await prisma.team.create({
    data: { name: 'MM team', orgId: org.id, slackChannelId: 'C01MMT00009' },
  });
  const feTeam = await prisma.team.create({
    data: { name: 'FE team', orgId: org.id, slackChannelId: 'C01FET00010' },
  });
  const mileniumFalconTeam = await prisma.team.create({
    data: { name: 'Milenium falcon', orgId: org.id, slackChannelId: 'C01MFT00011' },
  });
  const qaTeam = await prisma.team.create({
    data: { name: 'QA Team', orgId: org.id, slackChannelId: 'C01QA000012' },
  });

  type Seed = {
    name: string;
    email: string;
    role: 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';
    teamId: string | null;
    availability: 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';
  };

  // Fictional demo org. Adjust freely — first-listed person per team becomes TEAM_LEAD.
  const seeds: Seed[] = [
    // CEO — no team scope
    { name: 'William Graham', email: 'william.graham@acme.com', role: 'ADMIN', teamId: null, availability: 'AVAILABLE' },

    // Account (Sign up / Log in / KYC / MFA)
    { name: 'Nathan Price', email: 'nathan.price@acme.com', role: 'TEAM_LEAD', teamId: accountTeam.id, availability: 'AVAILABLE' },
    { name: 'Grace Sullmarcus', email: 'grace.sullmarcus@acme.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'AVAILABLE' },
    { name: 'Thomas Kelly', email: 'thomas.kelly@acme.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'REMOTE' },
    { name: 'Emily Watson', email: 'emily.watson@acme.com', role: 'DEVELOPER', teamId: accountTeam.id, availability: 'AVAILABLE' },

    // Yield
    { name: 'Daniel Brooks', email: 'daniel.brooks@acme.com', role: 'TEAM_LEAD', teamId: yieldTeam.id, availability: 'REMOTE' },
    { name: 'Chloe Martin', email: 'chloe.martin@acme.com', role: 'DEVELOPER', teamId: yieldTeam.id, availability: 'AVAILABLE' },

    // Card Payments
    { name: 'Henry Carter', email: 'henry.carter@acme.com', role: 'TEAM_LEAD', teamId: cardPaymentsTeam.id, availability: 'AVAILABLE' },
    { name: 'Sarah Mitchell', email: 'sarah.mitchell@acme.com', role: 'DEVELOPER', teamId: cardPaymentsTeam.id, availability: 'AVAILABLE' },

    // Coins — Fiat & Crypto (Deposit / Withdrawal / Send / Receive)
    { name: 'Peter Novak', email: 'peter.novak@acme.com', role: 'TEAM_LEAD', teamId: coinsTeam.id, availability: 'AVAILABLE' },
    { name: 'Anna Rossi', email: 'anna.rossi@acme.com', role: 'DEVELOPER', teamId: coinsTeam.id, availability: 'AVAILABLE' },
    { name: 'Marcus Klein', email: 'marcus.klein@acme.com', role: 'DEVELOPER', teamId: coinsTeam.id, availability: 'REMOTE' },
    { name: 'David Fischer', email: 'david.fischer@acme.com', role: 'DEVELOPER', teamId: coinsTeam.id, availability: 'BUSY' },
    { name: 'Alex Morgan', email: 'alex.morgan@acme.com', role: 'ADMIN', teamId: coinsTeam.id, availability: 'AVAILABLE' },
    { name: 'Rachel Green', email: 'rachel.green@acme.com', role: 'DEVELOPER', teamId: coinsTeam.id, availability: 'AVAILABLE' },

    // Exchange
    { name: 'James Wilson', email: 'james.wilson@acme.com', role: 'TEAM_LEAD', teamId: exchangeTeam.id, availability: 'AVAILABLE' },
    { name: 'Sofia Almeida', email: 'sofia.almeida@acme.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'BUSY' },
    { name: 'Mateo Silva', email: 'mateo.silva@acme.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'AVAILABLE' },
    { name: 'Lucas Moretti', email: 'lucas.moretti@acme.com', role: 'DEVELOPER', teamId: exchangeTeam.id, availability: 'AVAILABLE' },

    // Metalback / Cashback
    { name: 'Ryan Harper', email: 'ryan.harper@acme.com', role: 'TEAM_LEAD', teamId: metalbackTeam.id, availability: 'REMOTE' },
    { name: 'Victor Owens', email: 'victor.owens@acme.com', role: 'DEVELOPER', teamId: metalbackTeam.id, availability: 'AVAILABLE' },

    // KPay
    { name: 'Michael Reyes', email: 'michael.reyes@acme.com', role: 'TEAM_LEAD', teamId: kpayTeam.id, availability: 'AVAILABLE' },
    { name: 'Laura Santos', email: 'laura.santos@acme.com', role: 'DEVELOPER', teamId: kpayTeam.id, availability: 'AVAILABLE' },

    // Transaction History & Reporting
    { name: 'Adam Bishop', email: 'adam.bishop@acme.com', role: 'TEAM_LEAD', teamId: transactionHistoryTeam.id, availability: 'AVAILABLE' },
    { name: 'Jack Rhodes', email: 'jack.rhodes@acme.com', role: 'DEVELOPER', teamId: transactionHistoryTeam.id, availability: 'AVAILABLE' },

    // MM team
    { name: 'Leo Vaughn', email: 'leo.vaughn@acme.com', role: 'TEAM_LEAD', teamId: mmTeam.id, availability: 'AVAILABLE' },
    { name: 'Sean OBrien', email: 'sean.obrien@acme.com', role: 'DEVELOPER', teamId: mmTeam.id, availability: 'AVAILABLE' },

    // FE team
    { name: 'Elena Vargas', email: 'elena.vargas@acme.com', role: 'TEAM_LEAD', teamId: feTeam.id, availability: 'BUSY' },

    // Milenium falcon
    { name: 'Ian Fletcher', email: 'ian.fletcher@acme.com', role: 'TEAM_LEAD', teamId: mileniumFalconTeam.id, availability: 'AVAILABLE' },
    { name: 'Owen Fletcher', email: 'owen.fletcher@acme.com', role: 'DEVELOPER', teamId: mileniumFalconTeam.id, availability: 'BUSY' },
    { name: 'Caleb Stone', email: 'caleb.stone@acme.com', role: 'DEVELOPER', teamId: mileniumFalconTeam.id, availability: 'AVAILABLE' },

    // QA Team
    { name: 'Nina Kowalski', email: 'nina.kowalski@acme.com', role: 'TEAM_LEAD', teamId: qaTeam.id, availability: 'ON_LEAVE' },
    { name: 'Toby Harris', email: 'toby.harris@acme.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Helena Ortiz', email: 'helena.ortiz@acme.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
    { name: 'Julia Weber', email: 'julia.weber@acme.com', role: 'DEVELOPER', teamId: qaTeam.id, availability: 'AVAILABLE' },
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

  const alex = id('alex.morgan@acme.com');
  const peter = id('peter.novak@acme.com');
  const david = id('david.fischer@acme.com');
  const rachel = id('rachel.green@acme.com');
  const marcus = id('marcus.klein@acme.com');
  const mateo = id('mateo.silva@acme.com');
  const james = id('james.wilson@acme.com');
  const anna = id('anna.rossi@acme.com');
  const sofia = id('sofia.almeida@acme.com');
  const nathan = id('nathan.price@acme.com');
  const emily = id('emily.watson@acme.com');
  const daniel = id('daniel.brooks@acme.com');
  const helena = id('helena.ortiz@acme.com');
  const julia = id('julia.weber@acme.com');
  const laura = id('laura.santos@acme.com');
  const nina = id('nina.kowalski@acme.com');
  const toby = id('toby.harris@acme.com');

  // Extra members pulled in to back the Resources seeds (parking, QA, prod-support)
  const elena = id('elena.vargas@acme.com');
  const ian = id('ian.fletcher@acme.com');
  const ryan = id('ryan.harper@acme.com');
  const owen = id('owen.fletcher@acme.com');
  const caleb = id('caleb.stone@acme.com');
  const chloe = id('chloe.martin@acme.com');
  const grace = id('grace.sullmarcus@acme.com');
  const jackRhodes = id('jack.rhodes@acme.com');
  const sarahMitchell = id('sarah.mitchell@acme.com');
  const thomasKelly = id('thomas.kelly@acme.com');
  const henry = id('henry.carter@acme.com');
  const lucas = id('lucas.moretti@acme.com');
  const michael= id('michael.reyes@acme.com');
  const adamBishop = id('adam.bishop@acme.com');
  const victorOwens = id('victor.owens@acme.com');
  const leo = id('leo.vaughn@acme.com');
  const sean = id('sean.obrien@acme.com');

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
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw1.id, userId: david } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw1.id, userId: rachel } });

  const dw2 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-042',
      jiraId: '10042',
      title: 'Crypto deposit — confirmations below threshold',
      description: 'Edge: deposits credited before required confirmations when node reports stale head.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw2.id, userId: peter } });

  const dw3 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-038',
      jiraId: '10038',
      title: 'Withdrawal limits — daily cap per currency',
      description: 'Apply per-currency daily caps and surface the remaining amount in the UI.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw3.id, userId: marcus } });

  await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Runbook — stuck deposit remediation',
      description: 'Document the triage and manual-credit flow for stuck deposits.',
      status: 'TODO',
      priority: 'LOW',
      teamId: coinsTeam.id,
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
  await prisma.ticketAssignment.create({ data: { ticketId: ex1.id, userId: mateo } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex1.id, userId: james } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex2.id, userId: sofia } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac1.id, userId: nathan } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac2.id, userId: emily } });
  await prisma.ticketAssignment.create({ data: { ticketId: ac2.id, userId: daniel } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa1.id, userId: helena } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa2.id, userId: julia } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa2.id, userId: toby } });

  const qa3 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Smoke tests — add to CI main branch',
      status: 'IN_REVIEW',
      priority: 'LOW',
      teamId: qaTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: qa3.id, userId: laura } });

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
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw5.id, userId: david } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw5.id, userId: marcus } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw5.id, userId: anna } });

  const dw6 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-046',
      jiraId: '10046',
      title: 'Withdrawal fee calculator refactor',
      description: 'Extract fee rules into a config table and add per-tier overrides.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw6.id, userId: rachel } });

  const dw7 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-044',
      jiraId: '10044',
      title: 'USD wire deposits — SWIFT integration',
      description: 'Connect to partner bank SWIFT endpoint; parse MT103 inbound messages into deposits.',
      status: 'TODO',
      priority: 'HIGH',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw7.id, userId: peter } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw7.id, userId: anna } });

  const dw8 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-035',
      jiraId: '10035',
      title: 'Reconciliation report v2 — drill-through',
      description: 'Support per-transaction drill-through from the daily reconciliation report.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw8.id, userId: rachel } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw8.id, userId: anna } });

  const dw9 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-025',
      jiraId: '10025',
      title: 'Audit log — deposit trail',
      description: 'Record every status change on a deposit with actor and source system.',
      status: 'DONE',
      priority: 'LOW',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(30),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw9.id, userId: david } });

  const dw10 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Weekly reconciliation runbook',
      description: 'Step-by-step for the weekly Monday reconciliation call.',
      status: 'TODO',
      priority: 'LOW',
      teamId: coinsTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw10.id, userId: marcus } });

  const dw11 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Transaction age metric in Grafana',
      description: 'Dashboard showing age of the oldest unresolved deposit per PSP.',
      status: 'TODO',
      priority: 'MEDIUM',
      teamId: coinsTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw11.id, userId: peter } });
  await prisma.ticketAssignment.create({ data: { ticketId: dw11.id, userId: marcus } });

  const dw12 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DW-050',
      jiraId: '10050',
      title: 'Payout scheduling — timezone bug',
      description: 'Cron lands at 23:00 UTC instead of local time for non-UTC orgs.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: coinsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: dw12.id, userId: anna } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex3.id, userId: mateo } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex3.id, userId: james } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex3.id, userId: sofia } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex4.id, userId: james } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex5.id, userId: mateo } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex6.id, userId: sofia } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex7.id, userId: james } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex7.id, userId: sofia } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ex8.id, userId: mateo } });
  await prisma.ticketAssignment.create({ data: { ticketId: ex8.id, userId: sofia } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac3.id, userId: nathan } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac4.id, userId: emily } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac5.id, userId: daniel } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac6.id, userId: nathan } });
  await prisma.ticketAssignment.create({ data: { ticketId: ac6.id, userId: emily } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac7.id, userId: nathan } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: ac8.id, userId: daniel } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa4.id, userId: helena } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa4.id, userId: julia } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa5.id, userId: laura } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa6.id, userId: toby } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa7.id, userId: julia } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa7.id, userId: laura } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa8.id, userId: nina } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa9.id, userId: toby } });
  await prisma.ticketAssignment.create({ data: { ticketId: qa9.id, userId: helena } });

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
  await prisma.ticketAssignment.create({ data: { ticketId: qa10.id, userId: helena } });

  // ─── STANDUPS — today ───────────────────────────────────────────────────
  await prisma.standup.create({
    data: {
      userId: peter,
      teamId: coinsTeam.id,
      yesterday: 'Release planning, coordinated SEPA retry spec with David and Rachel.',
      today: 'DW-042 triage. Available for questions.',
      blockers: null,
      capacityPct: 60,
      postedAt: hoursAgo(6),
    },
  });

  await prisma.standup.create({
    data: {
      userId: david,
      teamId: coinsTeam.id,
      yesterday: 'Idempotency keys for SEPA retries.',
      today: 'Continuing DW-041. Full day — no capacity for new tasks.',
      blockers: 'Need staging DB dump refreshed — @Peter',
      capacityPct: 95,
      postedAt: hoursAgo(5),
    },
  });

  await prisma.standup.create({
    data: {
      userId: rachel,
      teamId: coinsTeam.id,
      yesterday: 'SEPA retry PR reviewed; added test coverage.',
      today: 'Pairing with David on DW-041. Some capacity for reviews.',
      blockers: null,
      capacityPct: 70,
      postedAt: hoursAgo(4),
    },
  });

  await prisma.standup.create({
    data: {
      userId: marcus,
      teamId: coinsTeam.id,
      yesterday: 'DW-038 cap enforcement done; PR up for review.',
      today: 'Remote today. Responding to review comments.',
      blockers: null,
      capacityPct: 50,
      postedAt: hoursAgo(3),
    },
  });

  await prisma.standup.create({
    data: {
      userId: mateo,
      teamId: exchangeTeam.id,
      yesterday: 'Planning partial fill UX with James.',
      today: 'Implementing incremental fill events on EX-017.',
      blockers: null,
      capacityPct: 70,
      postedAt: hoursAgo(3),
    },
  });

  await prisma.standup.create({
    data: {
      userId: helena,
      teamId: qaTeam.id,
      yesterday: 'Investigated flaky withdrawal tests — suspect is queue backpressure.',
      today: 'Reproducing QA-015 under load; assigning fixtures to Toby.',
      blockers: null,
      capacityPct: 60,
      postedAt: hoursAgo(2),
    },
  });

  await prisma.standup.create({
    data: {
      userId: nathan,
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
      userId: peter,
      teamId: coinsTeam.id,
      yesterday: 'Client call, architecture review for Q3.',
      today: 'Release coordination, onboarding Marcus to the payouts flow.',
      blockers: null,
      capacityPct: 55,
      postedAt: new Date(yesterday.getTime() + 9.5 * 3600 * 1000),
    },
  });
  await prisma.standup.create({
    data: {
      userId: david,
      teamId: coinsTeam.id,
      yesterday: 'Backlog grooming, Jira cleanup.',
      today: 'Starting on SEPA retries with Rachel.',
      blockers: null,
      capacityPct: 80,
      postedAt: new Date(yesterday.getTime() + 9.3 * 3600 * 1000),
    },
  });

  // ─── LEAVES ─────────────────────────────────────────────────────────────
  // Nina currently on annual leave
  await prisma.leaveRequest.create({
    data: {
      userId: nina,
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: daysFromToday(-2),
      endDate: daysFromToday(2),
      note: 'Pre-planned family trip.',
      reviewedBy: helena,
      reviewedAt: daysFromToday(-10),
      notifySlack: true,
    },
  });

  // Marcus remote day today
  await prisma.leaveRequest.create({
    data: {
      userId: marcus,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: today,
      endDate: today,
      reviewedBy: peter,
      reviewedAt: daysFromToday(-3),
      notifySlack: true,
    },
  });

  // David partial day last week
  await prisma.leaveRequest.create({
    data: {
      userId: david,
      type: 'PARTIAL_PM',
      status: 'APPROVED',
      startDate: daysFromToday(-7),
      endDate: daysFromToday(-7),
      note: 'Doctor appointment.',
      reviewedBy: peter,
      reviewedAt: daysFromToday(-9),
    },
  });

  // PENDING — Anna partial day
  await prisma.leaveRequest.create({
    data: {
      userId: anna,
      type: 'PARTIAL_AM',
      status: 'PENDING',
      startDate: daysFromToday(2),
      endDate: daysFromToday(2),
      note: 'Dentist in the morning.',
      notifySlack: true,
    },
  });

  // PENDING — Rachel annual leave
  await prisma.leaveRequest.create({
    data: {
      userId: rachel,
      type: 'ANNUAL',
      status: 'PENDING',
      startDate: daysFromToday(6),
      endDate: daysFromToday(8),
      note: 'Long weekend away.',
      notifySlack: true,
    },
  });

  // PENDING — Daniel remote day
  await prisma.leaveRequest.create({
    data: {
      userId: daniel,
      type: 'REMOTE',
      status: 'PENDING',
      startDate: daysFromToday(13),
      endDate: daysFromToday(13),
      notifySlack: true,
    },
  });

  // Julia approved remote block
  await prisma.leaveRequest.create({
    data: {
      userId: julia,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: daysFromToday(5),
      endDate: daysFromToday(9),
      note: 'Working from the coast this week.',
      reviewedBy: helena,
      reviewedAt: daysFromToday(-1),
    },
  });

  // Future scheduled
  await prisma.leaveRequest.create({
    data: {
      userId: nina,
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: daysFromToday(21),
      endDate: daysFromToday(23),
      reviewedBy: helena,
      reviewedAt: daysFromToday(-5),
    },
  });

  await prisma.leaveRequest.create({
    data: {
      userId: peter,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: daysFromToday(27),
      endDate: daysFromToday(28),
      reviewedBy: alex,
      reviewedAt: daysFromToday(-2),
    },
  });

  // ─── INTEGRATIONS ────────────────────────────────────────────────────────
  // Deliberately NOT seeded. SlackConfig.botToken + JiraConfig.apiToken are
  // stored AES-256-GCM encrypted and any plaintext placeholder here
  // (`PLACEHOLDER-REPLACE-VIA-UI`) is undecryptable — the first Test
  // connection blows up inside decrypt() with a cryptic Buffer error.
  // Leave the table empty so the Integrations UI shows the first-time
  // flow and forces the admin to paste real creds.

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
    [peter, mateo, nathan, helena, james, elena, ian],
    [alex, james, nathan, grace, david, ryan, ian],
    [peter, mateo, nathan, helena, henry, elena, caleb],
    [alex, james, marcus, chloe, rachel, owen, victorOwens],
    [peter, mateo, nathan, helena, jackRhodes, elena, ian],
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
  // branch + description live on the env itself now.
  const envSeed: { name: string; branch?: string; description?: string }[] = [
    { name: 'QA1', branch: 'temp/qa1-config', description: 'Gateway 21 integration surface' },
    { name: 'QA2', branch: 'qa2-config-v2', description: 'Withdrawal / Fireblocks migration' },
    { name: 'QA3', branch: 'feature/fraud-questionnaire' },
    { name: 'QA4', branch: 'qa4-config' },
    { name: 'QA5' },
    { name: 'QA6', branch: 'qa6-config' },
    { name: 'QA7', branch: 'payments-v2' },
    { name: 'QA8', branch: 'feature/new-deposit-queues' },
    { name: 'QA9' },
    { name: 'QA10' },
    { name: 'QA11' },
    { name: 'STG', branch: 'patch/stg-config', description: 'Pre-prod mirror' },
    { name: 'BETA', description: 'BETA customer preview' },
  ];

  const envIds: Record<string, string> = {};
  for (let i = 0; i < envSeed.length; i++) {
    const e = await prisma.qaEnvironment.create({
      data: {
        orgId: org.id,
        name: envSeed[i]!.name,
        branch: envSeed[i]!.branch,
        description: envSeed[i]!.description,
        order: i,
      },
    });
    envIds[envSeed[i]!.name] = e.id;
  }

  const qaBookings = [
    { env: 'QA1', service: 'Account management', feature: 'Gateway 21 project', clientTag: 'v2.4.1', devOwnerId: ryan, qaOwnerId: julia, status: 'IN_DEVELOPMENT', notes: 'Phase 2' },
    { env: 'QA1', service: 'Salesforce integration service', feature: 'Gateway 21 project', clientTag: 'v1.9.0-rc3', devOwnerId: jackRhodes, qaOwnerId: null, status: 'PAUSED', notes: 'Blocked because of Gateway21' },
    { env: 'QA2', service: 'Exchange services', feature: 'Health check endpoint', clientTag: 'v3.1.2', devOwnerId: james, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null },
    { env: 'QA2', service: 'withdrawal services', feature: 'Migrate to new Fireblocks SDK', clientTag: null, devOwnerId: david, qaOwnerId: null, status: 'PAUSED', notes: null },
    { env: 'QA2', service: 'account services', feature: 'Email MFA', clientTag: 'v4.0.0', devOwnerId: david, qaOwnerId: julia, status: 'IN_DEVELOPMENT', notes: 'Released V1' },
    { env: 'QA3', service: 'Fiat deposit processing', feature: 'Fraud Questionnaire', clientTag: 'v2.0.7', devOwnerId: anna, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null },
    { env: 'QA3', service: 'Exchange', feature: 'Maintenance guard', clientTag: null, devOwnerId: james, qaOwnerId: james, status: 'IN_DEVELOPMENT', notes: null },
    { env: 'QA4', service: 'Merchant services', feature: 'Merchant V2 Dashboard', clientTag: 'v3.4.0-beta.2', devOwnerId: grace, qaOwnerId: null, status: 'TEST_IN_QA', notes: null },
    { env: 'QA4', service: 'Account', feature: 'MFA improvements', clientTag: 'v2.1.5', devOwnerId: emily, qaOwnerId: nina, status: 'TEST_IN_QA', notes: null },
    { env: 'QA5', service: 'Account management', feature: 'KYB backfilling + account closure', clientTag: 'v2.4.0', devOwnerId: grace, qaOwnerId: null, status: 'TEST_IN_QA', notes: null },
    { env: 'QA5', service: 'KMS', feature: 'KYB backfilling', clientTag: 'v5.2.1', devOwnerId: elena, qaOwnerId: null, status: 'TEST_IN_QA', notes: null },
    { env: 'QA6', service: 'Yield engine', feature: 'Automate yield payments push', clientTag: 'v1.0.4', devOwnerId: chloe, qaOwnerId: chloe, status: 'TEST_IN_QA', notes: null },
    { env: 'QA6', service: 'Account', feature: 'T&C', clientTag: 'v2.1.6', devOwnerId: nathan, qaOwnerId: nina, status: 'PUSHED_TO_PROD', notes: null },
    { env: 'QA7', service: 'Withdrawal-api', feature: 'Payments v2', clientTag: '2026.04.17-rc2', devOwnerId: anna, qaOwnerId: toby, status: 'TEST_IN_QA', notes: null },
    { env: 'QA8', service: 'Fiat deposit services', feature: 'Yellowcard Phase 2.1', clientTag: 'v2.1.0', devOwnerId: rachel, qaOwnerId: toby, status: 'READY_FOR_PROD', notes: null },
    { env: 'QA9', service: 'Account', feature: 'New IP email', clientTag: 'v2.1.7', devOwnerId: nathan, qaOwnerId: helena, status: 'READY_FOR_PROD', notes: 'Request from Tom' },
    { env: 'QA9', service: 'profit-and-loss-processor', feature: 'New service', clientTag: null, devOwnerId: daniel, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null },
    { env: 'QA10', service: 'Debit card payment processing', feature: 'Chargebacks', clientTag: 'v1.3.0', devOwnerId: henry, qaOwnerId: nina, status: 'IN_DEVELOPMENT', notes: null },
    { env: 'QA10', service: 'Exchange', feature: 'Order amendment fix', clientTag: 'v3.1.3', devOwnerId: sofia, qaOwnerId: julia, status: 'TEST_IN_QA', notes: null },
    { env: 'STG', service: 'Kinesis test automation', feature: 'Crypto deposit/withdrawal email MFA', clientTag: '2026.04.19', devOwnerId: toby, qaOwnerId: null, status: 'IN_DEVELOPMENT', notes: null },
    { env: 'BETA', service: 'KMS - BETA', feature: 'CoinWatch V1 - review', clientTag: 'v0.9.0-beta', devOwnerId: mateo, qaOwnerId: helena, status: 'TEST_IN_QA', notes: null },
  ] as const;

  for (const b of qaBookings) {
    await prisma.qaBooking.create({
      data: {
        environmentId: envIds[b.env]!,
        service: b.service,
        feature: b.feature,
        clientTag: b.clientTag,
        devOwnerId: b.devOwnerId,
        qaOwnerId: b.qaOwnerId,
        status: b.status,
        notes: b.notes,
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
      teamId: coinsTeam.id,
      pairs: [
        [rachel, peter],
        [alex, marcus],
        [david, rachel],
        [peter, anna],
        [alex, david],
        [peter, marcus],
        [anna, rachel],
        [alex, peter],
        [marcus, rachel],
        [anna, david],
      ],
    },
    {
      teamId: exchangeTeam.id,
      pairs: [
        [mateo, james],
        [james, sofia],
        [mateo, lucas],
        [james, mateo],
        [sofia, lucas],
        [mateo, james],
        [james, sofia],
        [mateo, lucas],
        [james, sofia],
        [mateo, james],
      ],
    },
    {
      teamId: accountTeam.id,
      pairs: [
        [nathan, emily],
        [emily, grace],
        [nathan, thomasKelly],
        [grace, thomasKelly],
        [nathan, emily],
        [emily, grace],
        [nathan, thomasKelly],
        [grace, nathan],
        [emily, thomasKelly],
        [nathan, grace],
      ],
    },
    {
      teamId: qaTeam.id,
      pairs: [
        [helena, julia],
        [julia, nina],
        [helena, toby],
        [nina, julia],
        [toby, helena],
        [helena, nina],
        [julia, toby],
        [nina, helena],
        [toby, julia],
        [helena, julia],
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

  // Alex (admin)
  await notify({
    userId: alex,
    type: 'LEAVE_PENDING',
    title: 'Pending leave requests',
    body: 'Peter has 3 leave requests waiting for approval.',
    linkPath: '/admin/leaves',
    actorId: peter,
    hoursAgo: 2,
  });
  await notify({
    userId: alex,
    type: 'BLOCKER_ON_TEAM',
    title: 'Blocker flagged by David',
    body: 'Need staging DB dump refreshed — tagged @Peter',
    linkPath: '/standup',
    actorId: david,
    hoursAgo: 5,
  });
  await notify({
    userId: alex,
    type: 'GENERIC',
    title: 'Welcome to Flowdruid!',
    body: 'Explore the dashboard, task board, and leave calendar.',
    hoursAgo: 48,
    read: true,
  });

  // Peter (lead)
  await notify({
    userId: peter,
    type: 'LEAVE_PENDING',
    title: '3 leave requests to review',
    body: 'Anna, Rachel, and Daniel are waiting.',
    linkPath: '/admin/leaves',
    hoursAgo: 3,
  });
  await notify({
    userId: peter,
    type: 'TICKET_SUGGESTED',
    title: 'David suggested you for a ticket',
    body: 'CR-042 — Client publish — repo update',
    linkPath: '/t/placeholder',
    actorId: david,
    hoursAgo: 1,
  });
  await notify({
    userId: peter,
    type: 'PROD_SUPPORT_ON_CALL',
    title: "You're on call this week",
    body: 'Deposit / Withdrawal team — primary this week.',
    linkPath: '/prod-support',
    hoursAgo: 24,
  });

  // David
  await notify({
    userId: david,
    type: 'TICKET_ASSIGNED',
    title: 'Rachel assigned you to DW-045',
    body: 'Webhook signature verification',
    linkPath: '/tasks',
    actorId: rachel,
    hoursAgo: 6,
  });
  await notify({
    userId: david,
    type: 'STANDUP_MENTION',
    title: 'Peter mentioned you in standup',
    body: 'Pairing on fiat deposit processing today.',
    linkPath: '/standup',
    actorId: peter,
    hoursAgo: 7,
  });

  // Anna
  await notify({
    userId: anna,
    type: 'LEAVE_APPROVED',
    title: 'Your leave request was approved',
    body: 'Partial AM on Wednesday — enjoy the dentist visit.',
    linkPath: '/leave/request',
    actorId: peter,
    hoursAgo: 4,
  });

  // Rachel
  await notify({
    userId: rachel,
    type: 'TICKET_STATUS',
    title: 'CR-033 moved to Done',
    body: 'Auth token refresh edge case closed.',
    linkPath: '/tasks',
    hoursAgo: 26,
    read: true,
  });

  // Helena (QA lead)
  await notify({
    userId: helena,
    type: 'LEAVE_PENDING',
    title: 'Nina requested annual leave',
    body: 'Review on /admin/leaves',
    linkPath: '/admin/leaves',
    actorId: nina,
    hoursAgo: 3,
  });

  // Nathan (Account lead)
  await notify({
    userId: nathan,
    type: 'TICKET_SUGGESTED',
    title: 'Alex suggested you for AC-024',
    body: 'Email verification — link expiry tuning',
    linkPath: '/t/placeholder',
    actorId: alex,
    hoursAgo: 8,
  });

  // ─── MESSAGING (team channels + sample DMs) ──────────────────────────────
  // One channel per team, every team member joined. A few recent messages each.
  const teamChannels: { teamId: string; members: string[]; name: string }[] = [
    {
      teamId: accountTeam.id,
      name: 'Account',
      members: [nathan, grace, thomasKelly, emily],
    },
    {
      teamId: yieldTeam.id,
      name: 'Yield',
      members: [daniel, chloe],
    },
    {
      teamId: cardPaymentsTeam.id,
      name: 'Card Payments',
      members: [henry, sarahMitchell],
    },
    {
      teamId: coinsTeam.id,
      name: 'Coins — Fiat & Crypto',
      members: [peter, anna, marcus, david, alex, rachel],
    },
    {
      teamId: exchangeTeam.id,
      name: 'Exchange',
      members: [james, sofia, mateo, lucas],
    },
    {
      teamId: metalbackTeam.id,
      name: 'Metalback / Cashback',
      members: [ryan, victorOwens],
    },
    {
      teamId: kpayTeam.id,
      name: 'KPay',
      members: [michael, laura],
    },
    {
      teamId: transactionHistoryTeam.id,
      name: 'Transaction History & Reporting',
      members: [adamBishop, jackRhodes],
    },
    {
      teamId: mmTeam.id,
      name: 'MM team',
      members: [leo, sean],
    },
    {
      teamId: feTeam.id,
      name: 'FE team',
      members: [elena],
    },
    {
      teamId: mileniumFalconTeam.id,
      name: 'Milenium falcon',
      members: [ian, owen, caleb],
    },
    {
      teamId: qaTeam.id,
      name: 'QA Team',
      members: [nina, toby, helena, julia],
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
    where: { teamId: coinsTeam.id, kind: 'TEAM_CHANNEL' },
  });
  if (dwChannel) {
    const msgs: { authorId: string; body: string; minutesAgo: number }[] = [
      { authorId: peter, body: 'Morning team — SEPA retry lands today, heads up.', minutesAgo: 180 },
      { authorId: david, body: 'Blocked on staging DB dump — @Krasi can you refresh?', minutesAgo: 150 },
      { authorId: peter, body: 'Refreshed. You should be unblocked now.', minutesAgo: 140 },
      { authorId: rachel, body: 'Will review DW-045 this afternoon', minutesAgo: 90 },
      { authorId: marcus, body: 'Remote today. Coffee is over-engineered.', minutesAgo: 60 },
      { authorId: david, body: 'Thanks ✅ Pushed the fix.', minutesAgo: 20 },
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
    // Mark Peter's last read as now (so he sees unread count 0), leave others as null (unread)
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: dwChannel.id, userId: peter } },
      data: { lastReadAt: new Date() },
    });
  }

  // Sample DM: Alex ↔ Peter
  const dm = await prisma.conversation.create({
    data: {
      orgId: org.id,
      kind: 'DM',
      members: { create: [{ userId: alex }, { userId: peter }] },
    },
  });
  const dmMsgs: { authorId: string; body: string; minutesAgo: number }[] = [
    { authorId: peter, body: 'Quick sync on Q3 roadmap tomorrow?', minutesAgo: 240 },
    { authorId: alex, body: 'Works. 10:00 OK?', minutesAgo: 220 },
    { authorId: peter, body: 'Perfect. Will share slides before.', minutesAgo: 210 },
    { authorId: alex, body: '👍', minutesAgo: 200 },
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
  // Pick the Exchange team's current-week shift (primary = Mateo Silva).
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
          title: 'Mateo Silva is looking for cover',
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
  console.log(`  Teams:     12`);
  console.log(`  Users:     ${seeds.length}`);
  console.log('');
  console.log('Login credentials — password for all users: Password123!');
  console.log('  Admin:          alex.morgan@acme.com');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

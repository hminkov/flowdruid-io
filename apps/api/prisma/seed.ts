// apps/api/prisma/seed.ts
//
// Seed data for Flowdruid — Cloudruid internal team.
// All user passwords are "Password123!" (hashed with bcryptjs cost 10).
// Dates are dynamically computed relative to "today" so the demo stays live.

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

  // Wipe existing data in reverse dependency order
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

  // ─── ORG ─────────────────────────────────────────────────────────────────
  const org = await prisma.organisation.create({
    data: { name: 'Cloudruid', slug: 'cloudruid' },
  });

  // ─── TEAMS ───────────────────────────────────────────────────────────────
  const devTeam = await prisma.team.create({
    data: { name: 'Dev', orgId: org.id, slackChannelId: 'C01DEV00001' },
  });
  const designTeam = await prisma.team.create({
    data: { name: 'Design', orgId: org.id, slackChannelId: 'C01DES00002' },
  });
  const opsTeam = await prisma.team.create({
    data: { name: 'Ops', orgId: org.id, slackChannelId: 'C01OPS00003' },
  });

  // ─── USERS ───────────────────────────────────────────────────────────────
  type Seed = {
    name: string;
    email: string;
    role: 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER';
    teamId: string | null;
    availability: 'AVAILABLE' | 'BUSY' | 'REMOTE' | 'ON_LEAVE';
  };

  const seeds: Seed[] = [
    // Admin — Hristo
    { name: 'Hristo Minkov', email: 'hristo.minkov@cloudruid.com', role: 'ADMIN', teamId: null, availability: 'AVAILABLE' },

    // Dev team
    { name: 'Krasimir Gizdov', email: 'krasimir.gizdov@cloudruid.com', role: 'TEAM_LEAD', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Aleksandar Angelov', email: 'aleksandar.angelov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Borislav Iliev', email: 'borislav.iliev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'BUSY' },
    { name: 'Dimitar Dimitrov', email: 'dimitar.dimitrov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Dimitar Kolev', email: 'dimitar.kolev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Dimitar Piskov', email: 'dimitar.piskov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'REMOTE' },
    { name: 'Dimitar Tagarev', email: 'dimitar.tagarev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Gabriel Mindev', email: 'gabriel.mindev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivan', email: 'ivan@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'REMOTE' },
    { name: 'Ivan Borisov', email: 'ivan.borisov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivaylo Hadzhiyski', email: 'ivaylo.hadzhiyski@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'BUSY' },
    { name: 'Ivaylo Iliev', email: 'ivaylo.iliev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Lazar', email: 'lazar@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Marian Valchinov', email: 'marian.valchinov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Martin Iliev', email: 'martin.iliev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Momchil Dimitrov', email: 'momchil.dimitrov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Nikola Valchinov', email: 'nikola.valchinov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'BUSY' },
    { name: 'Panayot', email: 'panayot@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Radoslav Dimitrov', email: 'radoslav.dimitrov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Renal Ahmedov', email: 'renal.ahmedov@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'REMOTE' },
    { name: 'Teodor Karakashev', email: 'teodor.karakashev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Tihomir Evgeniev', email: 'tihomir.evgeniev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Todor Kanev', email: 'todor.kanev@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Veso', email: 'veso@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'AVAILABLE' },
    { name: 'Viktor', email: 'viktor@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'BUSY' },
    { name: 'Boris', email: 'boris@cloudruid.com', role: 'DEVELOPER', teamId: devTeam.id, availability: 'ON_LEAVE' },

    // Design team
    { name: 'Svetli', email: 'svetli@cloudruid.com', role: 'TEAM_LEAD', teamId: designTeam.id, availability: 'AVAILABLE' },
    { name: 'Diana Demireva', email: 'diana.demireva@cloudruid.com', role: 'DEVELOPER', teamId: designTeam.id, availability: 'AVAILABLE' },
    { name: 'Ivelina Georgieva', email: 'ivelina.georgieva@cloudruid.com', role: 'DEVELOPER', teamId: designTeam.id, availability: 'BUSY' },
    { name: 'Veronika Kashaykova', email: 'veronika.kashaykova@cloudruid.com', role: 'DEVELOPER', teamId: designTeam.id, availability: 'AVAILABLE' },
    { name: 'Yuliia', email: 'yuliia@cloudruid.com', role: 'DEVELOPER', teamId: designTeam.id, availability: 'REMOTE' },

    // Ops team
    { name: 'HR', email: 'hr@cloudruid.com', role: 'TEAM_LEAD', teamId: opsTeam.id, availability: 'AVAILABLE' },
    { name: 'Ekaterina', email: 'ekaterina@cloudruid.com', role: 'DEVELOPER', teamId: opsTeam.id, availability: 'AVAILABLE' },
    { name: 'Elitsa', email: 'elitsa@cloudruid.com', role: 'DEVELOPER', teamId: opsTeam.id, availability: 'AVAILABLE' },
    { name: 'Martin Panayotov', email: 'martin.panayotov@cloudruid.com', role: 'DEVELOPER', teamId: opsTeam.id, availability: 'AVAILABLE' },
    { name: 'Radoslav Ivanov', email: 'radoslav.ivanov@cloudruid.com', role: 'DEVELOPER', teamId: opsTeam.id, availability: 'AVAILABLE' },
    { name: 'Ralitsa', email: 'ralitsa@cloudruid.com', role: 'DEVELOPER', teamId: opsTeam.id, availability: 'ON_LEAVE' },
  ];

  const users: Record<string, { id: string; name: string; email: string }> = {};
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

  const byEmail = (e: string) => users[e]!.id;

  const hristo = byEmail('hristo.minkov@cloudruid.com');
  const krasimir = byEmail('krasimir.gizdov@cloudruid.com');
  const borislav = byEmail('borislav.iliev@cloudruid.com');
  const dimitar = byEmail('dimitar.dimitrov@cloudruid.com');
  const ivan = byEmail('ivan@cloudruid.com');
  const nikola = byEmail('nikola.valchinov@cloudruid.com');
  const teodor = byEmail('teodor.karakashev@cloudruid.com');
  const gabriel = byEmail('gabriel.mindev@cloudruid.com');
  const momchil = byEmail('momchil.dimitrov@cloudruid.com');
  const boris = byEmail('boris@cloudruid.com');
  const ivaylo = byEmail('ivaylo.hadzhiyski@cloudruid.com');
  const elitsa = byEmail('elitsa@cloudruid.com');
  const svetli = byEmail('svetli@cloudruid.com');
  const veronika = byEmail('veronika.kashaykova@cloudruid.com');
  const diana = byEmail('diana.demireva@cloudruid.com');
  const hrUser = byEmail('hr@cloudruid.com');
  const ralitsa = byEmail('ralitsa@cloudruid.com');
  const martinPanayotov = byEmail('martin.panayotov@cloudruid.com');

  // ─── TICKETS — Dev team ──────────────────────────────────────────────────
  const t1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'CR-041',
      jiraId: '10041',
      title: 'Auth service — refresh token rotation',
      description: 'Rotate refresh tokens on every use and persist the family id for revocation.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: devTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: t1.id, userId: borislav } });
  await prisma.ticketAssignment.create({ data: { ticketId: t1.id, userId: dimitar } });

  const t2 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'CR-042',
      jiraId: '10042',
      title: 'Client build — publish v2.3.0',
      description: 'Urgent: publish latest changes to the client repo. Blocking QA.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: devTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: t2.id, userId: krasimir } });

  const t3 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'CR-038',
      jiraId: '10038',
      title: 'Migrate logging to OpenTelemetry',
      description: 'Replace the bespoke logger with OTel SDK + collector.',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: devTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: t3.id, userId: ivan } });

  const t4 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'CR-039',
      jiraId: '10039',
      title: 'Release pipeline — staging deploy flake',
      description: 'Staging deploy step fails intermittently on first run after a cold cache.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      teamId: devTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: t4.id, userId: nikola } });

  await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Update staging environment docs',
      description: 'Internal: staging setup guide is outdated since the Redis migration.',
      status: 'TODO',
      priority: 'LOW',
      teamId: devTeam.id,
    },
  });

  const t6 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'CR-033',
      jiraId: '10033',
      title: 'Edge case — refresh token mid-request returns 500',
      description: 'Refresh token expires between auth middleware and resolver; should be 401 not 500.',
      status: 'DONE',
      priority: 'LOW',
      teamId: devTeam.id,
      syncedAt: hoursAgo(24),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: t6.id, userId: momchil } });

  const t7 = await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Refactor email templates to MJML',
      description: 'Current templates use inline HTML — move to MJML for maintainability.',
      status: 'TODO',
      priority: 'MEDIUM',
      teamId: devTeam.id,
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: t7.id, userId: gabriel } });

  // ─── TICKETS — Design team ──────────────────────────────────────────────
  const d1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'DES-012',
      jiraId: '20012',
      title: 'Onboarding flow redesign',
      description: 'New onboarding screens for enterprise customers.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      teamId: designTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: d1.id, userId: veronika } });

  await prisma.ticket.create({
    data: {
      source: 'INTERNAL',
      title: 'Component library audit',
      status: 'TODO',
      priority: 'LOW',
      teamId: designTeam.id,
    },
  });

  // ─── TICKETS — Ops team ─────────────────────────────────────────────────
  const o1 = await prisma.ticket.create({
    data: {
      source: 'JIRA',
      jiraKey: 'OPS-007',
      jiraId: '30007',
      title: 'Postgres 16 upgrade on staging',
      status: 'IN_REVIEW',
      priority: 'MEDIUM',
      teamId: opsTeam.id,
      syncedAt: hoursAgo(1),
    },
  });
  await prisma.ticketAssignment.create({ data: { ticketId: o1.id, userId: martinPanayotov } });

  // ─── STANDUPS — today (Dev team) ─────────────────────────────────────────
  await prisma.standup.create({
    data: {
      userId: krasimir,
      teamId: devTeam.id,
      yesterday: 'Release planning, coordinated client publish with Borislav and Dimitar.',
      today: 'Working on release pipeline. Available for questions.',
      blockers: null,
      capacityPct: 60,
      postedAt: hoursAgo(6),
    },
  });

  await prisma.standup.create({
    data: {
      userId: borislav,
      teamId: devTeam.id,
      yesterday: 'Refresh token rotation, repo coordination.',
      today: 'Continuing CR-041. Full day — no capacity for new tasks.',
      blockers: 'Need staging DB dump refreshed — @Krasimir',
      capacityPct: 95,
      postedAt: hoursAgo(5),
    },
  });

  await prisma.standup.create({
    data: {
      userId: nikola,
      teamId: devTeam.id,
      yesterday: 'Pipeline investigation, staging config review.',
      today: 'Finishing release fix this morning. Free this afternoon.',
      blockers: null,
      capacityPct: 45,
      postedAt: hoursAgo(4),
    },
  });

  await prisma.standup.create({
    data: {
      userId: dimitar,
      teamId: devTeam.id,
      yesterday: 'Closed CR-033 (refresh token edge case).',
      today: 'Pairing with Borislav on CR-041. Some capacity for reviews.',
      blockers: null,
      capacityPct: 70,
      postedAt: hoursAgo(4),
    },
  });

  await prisma.standup.create({
    data: {
      userId: ivan,
      teamId: devTeam.id,
      yesterday: 'OpenTelemetry PR ready for review.',
      today: 'Remote today. Responding to review comments on CR-038.',
      blockers: null,
      capacityPct: 50,
      postedAt: hoursAgo(3),
    },
  });

  // Yesterday's standups
  const yesterdayDate = daysFromToday(-1);

  await prisma.standup.create({
    data: {
      userId: krasimir,
      teamId: devTeam.id,
      yesterday: 'Client call, architecture review for Q3 roadmap.',
      today: 'Release coordination, onboarding Borislav and Dimitar to the publish flow.',
      blockers: null,
      capacityPct: 55,
      postedAt: new Date(yesterdayDate.getTime() + 9.5 * 3600 * 1000),
    },
  });

  await prisma.standup.create({
    data: {
      userId: borislav,
      teamId: devTeam.id,
      yesterday: 'Backlog grooming, Jira cleanup.',
      today: 'Starting on token rotation with Dimitar.',
      blockers: null,
      capacityPct: 80,
      postedAt: new Date(yesterdayDate.getTime() + 9.3 * 3600 * 1000),
    },
  });

  // ─── LEAVE REQUESTS ─────────────────────────────────────────────────────
  // Boris currently on leave
  await prisma.leaveRequest.create({
    data: {
      userId: boris,
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: daysFromToday(-2),
      endDate: daysFromToday(2),
      note: 'Pre-planned family trip.',
      reviewedBy: krasimir,
      reviewedAt: daysFromToday(-10),
      notifySlack: true,
    },
  });

  // Boris had sick leave last week
  await prisma.leaveRequest.create({
    data: {
      userId: boris,
      type: 'SICK',
      status: 'APPROVED',
      startDate: daysFromToday(-6),
      endDate: daysFromToday(-5),
      reviewedBy: krasimir,
      reviewedAt: daysFromToday(-6),
    },
  });

  // Ivan remote days — approved
  await prisma.leaveRequest.create({
    data: {
      userId: ivan,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: daysFromToday(-9),
      endDate: daysFromToday(-8),
      reviewedBy: krasimir,
      reviewedAt: daysFromToday(-12),
    },
  });

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

  // Borislav partial day — approved (last week)
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

  // PENDING — partial day
  await prisma.leaveRequest.create({
    data: {
      userId: ivaylo,
      type: 'PARTIAL_AM',
      status: 'PENDING',
      startDate: daysFromToday(2),
      endDate: daysFromToday(2),
      note: 'Dentist in the morning.',
      notifySlack: true,
    },
  });

  // PENDING — 3-day annual leave
  await prisma.leaveRequest.create({
    data: {
      userId: teodor,
      type: 'ANNUAL',
      status: 'PENDING',
      startDate: daysFromToday(6),
      endDate: daysFromToday(8),
      note: 'Long weekend away.',
      notifySlack: true,
    },
  });

  // PENDING — remote day
  await prisma.leaveRequest.create({
    data: {
      userId: momchil,
      type: 'REMOTE',
      status: 'PENDING',
      startDate: daysFromToday(13),
      endDate: daysFromToday(13),
      notifySlack: true,
    },
  });

  // Design team leaves
  await prisma.leaveRequest.create({
    data: {
      userId: diana,
      type: 'REMOTE',
      status: 'APPROVED',
      startDate: daysFromToday(5),
      endDate: daysFromToday(9),
      note: 'Working from the coast this week.',
      reviewedBy: svetli,
      reviewedAt: daysFromToday(-1),
    },
  });

  // Ops team leaves
  await prisma.leaveRequest.create({
    data: {
      userId: ralitsa,
      type: 'SICK',
      status: 'APPROVED',
      startDate: daysFromToday(-2),
      endDate: daysFromToday(1),
      reviewedBy: hrUser,
      reviewedAt: daysFromToday(-2),
    },
  });

  // Future scheduled leave
  await prisma.leaveRequest.create({
    data: {
      userId: boris,
      type: 'ANNUAL',
      status: 'APPROVED',
      startDate: daysFromToday(21),
      endDate: daysFromToday(23),
      reviewedBy: krasimir,
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

  // ─── INTEGRATIONS (placeholder credentials) ─────────────────────────────
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
      projectKeys: ['CR', 'DES', 'OPS'],
      syncInterval: 15,
      lastSyncAt: hoursAgo(1),
    },
  });

  console.log('Seed complete.');
  console.log(`  Org:       ${org.name}`);
  console.log(`  Teams:     3  (Dev, Design, Ops)`);
  console.log(`  Users:     ${seeds.length}  (1 admin, 3 leads, ${seeds.length - 4} developers)`);
  console.log('');
  console.log('Login credentials — password for all users: Password123!');
  console.log('  Admin:       hristo.minkov@cloudruid.com');
  console.log('  Dev lead:    krasimir.gizdov@cloudruid.com');
  console.log('  Design lead: svetli@cloudruid.com');
  console.log('  Ops lead:    hr@cloudruid.com');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

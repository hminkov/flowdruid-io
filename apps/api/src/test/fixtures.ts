import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PrismaClient, Role } from '@prisma/client';

/**
 * Helpers for building test data. Every test should start from an
 * empty DB (the setup file truncates before each test) and call
 * these to set up just what it needs — no sharing of fixtures
 * between tests.
 */

const PASSWORD = 'Password123!';

export async function createOrg(prisma: PrismaClient, name = 'TestOrg') {
  return prisma.organisation.create({
    data: { name, slug: name.toLowerCase() },
  });
}

export async function createTeam(
  prisma: PrismaClient,
  orgId: string,
  name = 'Engineering',
) {
  return prisma.team.create({ data: { name, orgId } });
}

export async function createUser(
  prisma: PrismaClient,
  opts: {
    orgId: string;
    teamId?: string | null;
    role?: Role;
    email?: string;
    name?: string;
  },
) {
  const email = opts.email ?? `user-${Math.random().toString(36).slice(2, 8)}@acme.com`;
  const name = opts.name ?? 'Test User';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

  return prisma.user.create({
    data: {
      email,
      name,
      initials,
      passwordHash: await bcrypt.hash(PASSWORD, 4), // cost 4 is fine for tests
      role: opts.role ?? 'DEVELOPER',
      orgId: opts.orgId,
      teamId: opts.teamId ?? null,
    },
  });
}

/**
 * Forge an access token for a test user. Uses the same JWT_SECRET
 * that setup.ts wires so tRPC context can verify it.
 */
export function tokenFor(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  teamId: string | null;
}) {
  return jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

export const TEST_PASSWORD = PASSWORD;

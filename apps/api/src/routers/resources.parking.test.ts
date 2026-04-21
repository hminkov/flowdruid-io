import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

const TODAY = '2026-05-01';
const TOMORROW = '2026-05-02';

describe('resources parking', () => {
  async function setupOrgWithSpots(count = 2) {
    const org = await createOrg(testPrisma);
    const spots = await Promise.all(
      Array.from({ length: count }).map((_, i) =>
        testPrisma.parkingSpot.create({
          data: { orgId: org.id, name: `Spot ${i + 1}`, order: i + 1 },
        }),
      ),
    );
    return { org, spots };
  }

  it('claim assigns the user to the spot for the given date', async () => {
    const { org, spots } = await setupOrgWithSpots();
    const user = await createUser(testPrisma, { orgId: org.id });

    await asUser(user).resources.claimParking({
      spotId: spots[0]!.id,
      date: TODAY,
    });

    const assignments = await testPrisma.parkingAssignment.findMany({
      where: { spotId: spots[0]!.id },
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.userId).toBe(user.id);
  });

  it('blocks a user claiming a second spot on the same day', async () => {
    const { org, spots } = await setupOrgWithSpots(2);
    const user = await createUser(testPrisma, { orgId: org.id });

    await asUser(user).resources.claimParking({ spotId: spots[0]!.id, date: TODAY });
    await expect(
      asUser(user).resources.claimParking({ spotId: spots[1]!.id, date: TODAY }),
    ).rejects.toThrow(/release it first/i);
  });

  it('allows claiming a different spot on a different day', async () => {
    const { org, spots } = await setupOrgWithSpots(2);
    const user = await createUser(testPrisma, { orgId: org.id });

    await asUser(user).resources.claimParking({ spotId: spots[0]!.id, date: TODAY });
    await asUser(user).resources.claimParking({ spotId: spots[1]!.id, date: TOMORROW });

    const all = await testPrisma.parkingAssignment.findMany({ where: { userId: user.id } });
    expect(all).toHaveLength(2);
  });

  it('re-claim on the same spot/day upserts (no duplicate)', async () => {
    const { org, spots } = await setupOrgWithSpots();
    const user = await createUser(testPrisma, { orgId: org.id });

    await asUser(user).resources.claimParking({ spotId: spots[0]!.id, date: TODAY });
    await asUser(user).resources.claimParking({ spotId: spots[0]!.id, date: TODAY });

    const all = await testPrisma.parkingAssignment.findMany({
      where: { spotId: spots[0]!.id },
    });
    expect(all).toHaveLength(1);
  });

  it('claim on a spot from another org is rejected', async () => {
    const orgA = await createOrg(testPrisma, 'A');
    const orgB = await createOrg(testPrisma, 'B');
    const spotB = await testPrisma.parkingSpot.create({
      data: { orgId: orgB.id, name: 'B1', order: 1 },
    });
    const userA = await createUser(testPrisma, { orgId: orgA.id });

    await expect(
      asUser(userA).resources.claimParking({ spotId: spotB.id, date: TODAY }),
    ).rejects.toThrow();
  });

  it('release removes the booking', async () => {
    const { org, spots } = await setupOrgWithSpots();
    const user = await createUser(testPrisma, { orgId: org.id });

    await asUser(user).resources.claimParking({ spotId: spots[0]!.id, date: TODAY });
    await asUser(user).resources.releaseParking({ spotId: spots[0]!.id, date: TODAY });

    const all = await testPrisma.parkingAssignment.findMany();
    expect(all).toHaveLength(0);
  });
});

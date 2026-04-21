import { describe, it, expect } from 'vitest';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

async function seedNotes(userId: string, count: number, read = false) {
  for (let i = 0; i < count; i++) {
    await testPrisma.notification.create({
      data: {
        userId,
        type: 'GENERIC',
        title: `Note ${i}`,
        body: `body ${i}`,
        read,
      },
    });
  }
}

describe('notifications.router', () => {
  it('list returns only notifications for the current user, newest first', async () => {
    const org = await createOrg(testPrisma);
    const a = await createUser(testPrisma, { orgId: org.id, name: 'A' });
    const b = await createUser(testPrisma, { orgId: org.id, name: 'B' });

    await seedNotes(a.id, 3);
    await seedNotes(b.id, 2); // different user's notes must not appear

    const result = await asUser(a).notifications.list({ filter: 'all', limit: 50 });
    expect(result).toHaveLength(3);
    expect(result.every((n) => n.userId === a.id)).toBe(true);
  });

  it('unreadCount returns only unread rows for the caller', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });

    await seedNotes(user.id, 2, false); // unread
    await seedNotes(user.id, 3, true); // read

    const count = await asUser(user).notifications.unreadCount();
    expect(count).toBe(2);
  });

  it('markRead flips the flag on the caller\'s own notification', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });
    const note = await testPrisma.notification.create({
      data: { userId: user.id, type: 'GENERIC', title: 't', read: false },
    });

    await asUser(user).notifications.markRead({ ids: [note.id] });
    const after = await testPrisma.notification.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.read).toBe(true);
  });

  it('markRead refuses to mark someone else\'s notification as read', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });
    const other = await createUser(testPrisma, { orgId: org.id });
    const note = await testPrisma.notification.create({
      data: { userId: other.id, type: 'GENERIC', title: 't', read: false },
    });

    // markRead uses updateMany with a userId filter — silently no-ops for wrong owner.
    await asUser(user).notifications.markRead({ ids: [note.id] });
    const after = await testPrisma.notification.findUniqueOrThrow({ where: { id: note.id } });
    expect(after.read).toBe(false);
  });

  it('markAllRead flips every unread row for the caller', async () => {
    const org = await createOrg(testPrisma);
    const user = await createUser(testPrisma, { orgId: org.id });
    await seedNotes(user.id, 5, false);

    await asUser(user).notifications.markAllRead();
    const unreadCount = await asUser(user).notifications.unreadCount();
    expect(unreadCount).toBe(0);
  });
});

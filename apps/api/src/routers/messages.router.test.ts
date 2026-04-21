import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { testPrisma } from '../test/setup';
import { createOrg, createUser } from '../test/fixtures';
import { asUser } from '../test/caller';

describe('messages.router', () => {
  describe('openDm', () => {
    it('creates a DM conversation with the two members', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id, name: 'A' });
      const b = await createUser(testPrisma, { orgId: org.id, name: 'B' });

      const { id } = await asUser(a).messages.openDm({ userId: b.id });

      const conv = await testPrisma.conversation.findUniqueOrThrow({
        where: { id },
        include: { members: true },
      });
      expect(conv.kind).toBe('DM');
      expect(conv.members).toHaveLength(2);
      const memberIds = conv.members.map((m) => m.userId).sort();
      expect(memberIds).toEqual([a.id, b.id].sort());
    });

    it('is idempotent — calling twice returns the same conversation', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });

      const first = await asUser(a).messages.openDm({ userId: b.id });
      const second = await asUser(a).messages.openDm({ userId: b.id });

      expect(first.id).toBe(second.id);
      const count = await testPrisma.conversation.count({ where: { orgId: org.id, kind: 'DM' } });
      expect(count).toBe(1);
    });

    it('rejects self-DM', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      await expect(asUser(a).messages.openDm({ userId: a.id })).rejects.toThrow(/Cannot DM yourself/i);
    });

    it('rejects cross-org DM', async () => {
      const orgA = await createOrg(testPrisma, 'A');
      const orgB = await createOrg(testPrisma, 'B');
      const a = await createUser(testPrisma, { orgId: orgA.id });
      const b = await createUser(testPrisma, { orgId: orgB.id });
      await expect(asUser(a).messages.openDm({ userId: b.id })).rejects.toThrow(TRPCError);
    });
  });

  describe('send + messages + markConversationRead', () => {
    it('members can send and list; non-members cannot', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });
      const outsider = await createUser(testPrisma, { orgId: org.id });

      const { id: convId } = await asUser(a).messages.openDm({ userId: b.id });

      await asUser(a).messages.send({ conversationId: convId, body: 'hello' });
      await asUser(b).messages.send({ conversationId: convId, body: 'right back at you' });

      const listed = await asUser(a).messages.messages({ conversationId: convId, limit: 50 });
      expect(listed).toHaveLength(2);
      expect(listed[0]?.body).toBe('hello');

      // An outsider is not a member and should be refused.
      await expect(
        asUser(outsider).messages.messages({ conversationId: convId, limit: 50 }),
      ).rejects.toThrow();
    });

    it('markConversationRead stamps lastReadAt for the caller only', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });
      const { id: convId } = await asUser(a).messages.openDm({ userId: b.id });
      await asUser(a).messages.send({ conversationId: convId, body: 'x' });

      await asUser(b).messages.markRead({ conversationId: convId });
      const members = await testPrisma.conversationMember.findMany({ where: { conversationId: convId } });
      const memberB = members.find((m) => m.userId === b.id)!;
      const memberA = members.find((m) => m.userId === a.id)!;
      expect(memberB.lastReadAt).not.toBeNull();
      // A's read marker only moves when A sends or explicitly reads — send() bumps it
      // but they didn't explicitly markConversationRead so the values are allowed to differ.
      expect(memberA.lastReadAt).not.toBeNull(); // A's send bumped their own marker
    });
  });

  describe('edit + delete', () => {
    it('author can edit their own message within the window', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });
      const { id: convId } = await asUser(a).messages.openDm({ userId: b.id });
      const msg = await asUser(a).messages.send({ conversationId: convId, body: 'original' });

      const edited = await asUser(a).messages.edit({ messageId: msg.id, body: 'fixed typo' });
      expect(edited.body).toBe('fixed typo');
      expect(edited.editedAt).not.toBeNull();
    });

    it('non-author cannot edit', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });
      const { id: convId } = await asUser(a).messages.openDm({ userId: b.id });
      const msg = await asUser(a).messages.send({ conversationId: convId, body: 'original' });

      await expect(
        asUser(b).messages.edit({ messageId: msg.id, body: 'nope' }),
      ).rejects.toThrow();
    });

    it('author can soft-delete their own message', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });
      const { id: convId } = await asUser(a).messages.openDm({ userId: b.id });
      const msg = await asUser(a).messages.send({ conversationId: convId, body: 'oops' });

      await asUser(a).messages.delete({ messageId: msg.id });
      const after = await testPrisma.message.findUniqueOrThrow({ where: { id: msg.id } });
      expect(after.deletedAt).not.toBeNull();
    });
  });

  describe('conversations', () => {
    it('lists the caller\'s memberships with unread counts', async () => {
      const org = await createOrg(testPrisma);
      const a = await createUser(testPrisma, { orgId: org.id });
      const b = await createUser(testPrisma, { orgId: org.id });
      const { id: convId } = await asUser(a).messages.openDm({ userId: b.id });
      // b sends two messages; a has not read either yet.
      await asUser(b).messages.send({ conversationId: convId, body: 'one' });
      await asUser(b).messages.send({ conversationId: convId, body: 'two' });

      const result = await asUser(a).messages.conversations();
      expect(result).toHaveLength(1);
      expect(result[0]?.unreadCount).toBe(2);
    });
  });
});

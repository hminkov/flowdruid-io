import { TRPCError } from '@trpc/server';
import {
  openDmSchema,
  listMessagesSchema,
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  markConversationReadSchema,
} from '@flowdruid/shared';
import { router, protectedProcedure } from '../trpc';
import { publish } from '../lib/events';

export const messagesRouter = router({
  /**
   * List conversations the current user is in: DMs they participate in, plus
   * the channel for their team. Team channels are org-wide read-only for
   * admins (no teamId); here we only surface the user's own team channel.
   */
  conversations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.conversationMember.findMany({
      where: { userId: ctx.user.id },
      include: {
        conversation: {
          include: {
            team: { select: { id: true, name: true } },
            members: {
              include: {
                user: { select: { id: true, name: true, initials: true } },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { author: { select: { id: true, name: true, initials: true } } },
            },
          },
        },
      },
    });

    // Ensure admins (no teamId) still see every team channel so the whole workspace is reachable
    const extraChannels =
      ctx.user.role === 'ADMIN'
        ? await ctx.prisma.conversation.findMany({
            where: {
              orgId: ctx.user.orgId,
              kind: 'TEAM_CHANNEL',
              id: { notIn: memberships.map((m) => m.conversationId) },
            },
            include: {
              team: { select: { id: true, name: true } },
              members: {
                include: { user: { select: { id: true, name: true, initials: true } } },
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { author: { select: { id: true, name: true, initials: true } } },
              },
            },
          })
        : [];

    const payload = [
      ...memberships.map((m) => ({
        ...m.conversation,
        lastReadAt: m.lastReadAt,
        isMember: true,
      })),
      ...extraChannels.map((c) => ({ ...c, lastReadAt: null, isMember: false })),
    ];

    // Sort: most recent activity first (latest message or conversation.updatedAt)
    payload.sort((a, b) => {
      const tA = a.messages[0]?.createdAt ?? a.updatedAt;
      const tB = b.messages[0]?.createdAt ?? b.updatedAt;
      return new Date(tB).getTime() - new Date(tA).getTime();
    });

    // Unread count per conversation: messages newer than lastReadAt and not by me
    const unreadCounts = new Map<string, number>();
    for (const c of payload) {
      if (!c.isMember) {
        unreadCounts.set(c.id, 0);
        continue;
      }
      const lastReadAt = c.lastReadAt ?? new Date(0);
      const count = await ctx.prisma.message.count({
        where: {
          conversationId: c.id,
          createdAt: { gt: lastReadAt },
          authorId: { not: ctx.user.id },
          deletedAt: null,
        },
      });
      unreadCounts.set(c.id, count);
    }

    return payload.map((c) => ({ ...c, unreadCount: unreadCounts.get(c.id) ?? 0 }));
  }),

  unreadTotal: protectedProcedure.query(async ({ ctx }) => {
    // Sum of unread messages across the caller's conversations
    const memberships = await ctx.prisma.conversationMember.findMany({
      where: { userId: ctx.user.id },
      select: { conversationId: true, lastReadAt: true },
    });
    let total = 0;
    for (const m of memberships) {
      const c = await ctx.prisma.message.count({
        where: {
          conversationId: m.conversationId,
          createdAt: { gt: m.lastReadAt ?? new Date(0) },
          authorId: { not: ctx.user.id },
          deletedAt: null,
        },
      });
      total += c;
    }
    return total;
  }),

  /**
   * Open (or create) a 1:1 DM with another user. Idempotent.
   */
  openDm: protectedProcedure.input(openDmSchema).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot DM yourself' });
    }

    const other = await ctx.prisma.user.findFirst({
      where: { id: input.userId, orgId: ctx.user.orgId },
      select: { id: true, name: true },
    });
    if (!other) throw new TRPCError({ code: 'NOT_FOUND' });

    // Find an existing DM with exactly these two participants
    const existing = await ctx.prisma.conversation.findFirst({
      where: {
        orgId: ctx.user.orgId,
        kind: 'DM',
        members: {
          every: { userId: { in: [ctx.user.id, input.userId] } },
        },
        AND: [
          { members: { some: { userId: ctx.user.id } } },
          { members: { some: { userId: input.userId } } },
        ],
      },
      select: { id: true },
    });
    if (existing) return existing;

    const created = await ctx.prisma.conversation.create({
      data: {
        orgId: ctx.user.orgId,
        kind: 'DM',
        members: {
          create: [
            { userId: ctx.user.id },
            { userId: input.userId },
          ],
        },
      },
      select: { id: true },
    });
    return created;
  }),

  messages: protectedProcedure.input(listMessagesSchema).query(async ({ ctx, input }) => {
    const conv = await ensureReadable(ctx, input.conversationId);
    return ctx.prisma.message.findMany({
      where: {
        conversationId: conv.id,
        ...(input.before ? { createdAt: { lt: new Date(input.before) } } : {}),
      },
      include: {
        author: { select: { id: true, name: true, initials: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: input.limit,
    });
  }),

  send: protectedProcedure.input(sendMessageSchema).mutation(async ({ ctx, input }) => {
    const conv = await ensureMember(ctx, input.conversationId);

    const message = await ctx.prisma.message.create({
      data: {
        conversationId: conv.id,
        authorId: ctx.user.id,
        body: input.body,
      },
      include: { author: { select: { id: true, name: true, initials: true } } },
    });

    // Bump conversation updatedAt
    await ctx.prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    // Mark our own read marker up to this message
    await ctx.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: conv.id, userId: ctx.user.id } },
      data: { lastReadAt: message.createdAt },
    });

    // Push a message.new event to every other conversation member
    // so their thread refreshes and their unread marker updates
    // without waiting for a poll.
    const members = await ctx.prisma.conversationMember.findMany({
      where: { conversationId: conv.id, userId: { not: ctx.user.id } },
      select: { userId: true },
    });
    await Promise.all(
      members.map((m) =>
        publish(ctx.user.orgId, m.userId, {
          type: 'message.new',
          conversationId: conv.id,
          messageId: message.id,
        }),
      ),
    );

    return message;
  }),

  edit: protectedProcedure.input(editMessageSchema).mutation(async ({ ctx, input }) => {
    const msg = await ctx.prisma.message.findFirst({
      where: { id: input.messageId, authorId: ctx.user.id, deletedAt: null },
    });
    if (!msg) throw new TRPCError({ code: 'NOT_FOUND' });
    return ctx.prisma.message.update({
      where: { id: input.messageId },
      data: { body: input.body, editedAt: new Date() },
      include: { author: { select: { id: true, name: true, initials: true } } },
    });
  }),

  delete: protectedProcedure.input(deleteMessageSchema).mutation(async ({ ctx, input }) => {
    const msg = await ctx.prisma.message.findFirst({
      where: { id: input.messageId, authorId: ctx.user.id, deletedAt: null },
    });
    if (!msg) throw new TRPCError({ code: 'NOT_FOUND' });
    await ctx.prisma.message.update({
      where: { id: input.messageId },
      data: { deletedAt: new Date(), body: '' },
    });
    return { ok: true };
  }),

  markRead: protectedProcedure
    .input(markConversationReadSchema)
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId: input.conversationId, userId: ctx.user.id },
        },
      });
      if (!membership) {
        // Admin viewing a channel without membership — quietly allow
        return { ok: true };
      }
      await ctx.prisma.conversationMember.update({
        where: {
          conversationId_userId: { conversationId: input.conversationId, userId: ctx.user.id },
        },
        data: { lastReadAt: new Date() },
      });
      return { ok: true };
    }),
});

// Ensure the caller can read this conversation (member or admin). Returns the conversation.
async function ensureReadable(
  ctx: { prisma: typeof import('../lib/prisma').prisma; user: { id: string; orgId: string; role: string } },
  conversationId: string
) {
  const conv = await ctx.prisma.conversation.findFirst({
    where: { id: conversationId, orgId: ctx.user.orgId },
  });
  if (!conv) throw new TRPCError({ code: 'NOT_FOUND' });

  if (ctx.user.role === 'ADMIN') return conv;

  const membership = await ctx.prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: ctx.user.id } },
  });
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });
  return conv;
}

// Same + must already be a member (can't post as a non-member admin to someone else's DM)
async function ensureMember(
  ctx: { prisma: typeof import('../lib/prisma').prisma; user: { id: string; orgId: string; role: string } },
  conversationId: string
) {
  const conv = await ctx.prisma.conversation.findFirst({
    where: { id: conversationId, orgId: ctx.user.orgId },
  });
  if (!conv) throw new TRPCError({ code: 'NOT_FOUND' });

  const membership = await ctx.prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: ctx.user.id } },
  });
  if (!membership) {
    if (conv.kind === 'TEAM_CHANNEL' && ctx.user.role === 'ADMIN') {
      // Auto-join admins on first post so their message appears as theirs
      await ctx.prisma.conversationMember.create({
        data: { conversationId: conv.id, userId: ctx.user.id },
      });
    } else {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
  }
  return conv;
}

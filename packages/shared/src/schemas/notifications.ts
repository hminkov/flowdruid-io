import { z } from 'zod';

export const notificationType = z.enum([
  'LEAVE_APPROVED',
  'LEAVE_DENIED',
  'LEAVE_PENDING',
  'BLOCKER_ON_TEAM',
  'TICKET_SUGGESTED',
  'TICKET_ASSIGNED',
  'TICKET_STATUS',
  'STANDUP_MENTION',
  'PROD_SUPPORT_ON_CALL',
  'GENERIC',
]);

export const notificationFilter = z.enum(['all', 'unread', 'mentions', 'actions']);

export const listNotificationsSchema = z.object({
  filter: notificationFilter.default('all'),
  limit: z.number().int().min(1).max(100).default(50),
});

export const markReadSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const createNotificationSchema = z.object({
  userId: z.string(),
  type: notificationType,
  title: z.string().min(1),
  body: z.string().optional(),
  linkPath: z.string().optional(),
  actorId: z.string().optional(),
  entityId: z.string().optional(),
});

export type NotificationType = z.infer<typeof notificationType>;
export type NotificationFilter = z.infer<typeof notificationFilter>;
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

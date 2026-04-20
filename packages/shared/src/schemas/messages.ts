import { z } from 'zod';

export const openDmSchema = z.object({
  userId: z.string(),
});

export const listMessagesSchema = z.object({
  conversationId: z.string(),
  limit: z.number().int().min(1).max(200).default(100),
  before: z.string().datetime().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string(),
  body: z.string().min(1).max(4000),
});

export const editMessageSchema = z.object({
  messageId: z.string(),
  body: z.string().min(1).max(4000),
});

export const deleteMessageSchema = z.object({
  messageId: z.string(),
});

export const markConversationReadSchema = z.object({
  conversationId: z.string(),
});

export type OpenDmInput = z.infer<typeof openDmSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

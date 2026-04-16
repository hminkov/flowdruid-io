import { z } from 'zod';

export const saveSlackConfigSchema = z.object({
  botToken: z.string().min(1),
  signingSecret: z.string().min(1),
  notifyStandup: z.boolean().default(true),
  notifyLeave: z.boolean().default(true),
  notifyBlocker: z.boolean().default(true),
  notifyDone: z.boolean().default(false),
  notifyBroadcast: z.boolean().default(true),
});

export const saveJiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
  projectKeys: z.array(z.string().min(1)),
  syncInterval: z.number().int().min(5).max(60).default(15),
});

export const broadcastSlackSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type SaveSlackConfigInput = z.infer<typeof saveSlackConfigSchema>;
export type SaveJiraConfigInput = z.infer<typeof saveJiraConfigSchema>;
export type BroadcastSlackInput = z.infer<typeof broadcastSlackSchema>;

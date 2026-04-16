import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slackChannelId: z.string().optional(),
});

export const updateTeamSchema = z.object({
  teamId: z.string(),
  name: z.string().min(1).max(100).optional(),
  slackChannelId: z.string().nullable().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

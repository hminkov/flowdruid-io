import { z } from 'zod';

export const postStandupSchema = z.object({
  teamId: z.string(),
  yesterday: z.string().min(1),
  today: z.string().min(1),
  blockers: z.string().optional(),
  capacityPct: z.number().int().min(0).max(100).default(50),
});

export const listStandupsSchema = z.object({
  teamId: z.string().optional(),
  date: z.string().optional(), // ISO date string
  userId: z.string().optional(),
});

export type PostStandupInput = z.infer<typeof postStandupSchema>;
export type ListStandupsInput = z.infer<typeof listStandupsSchema>;

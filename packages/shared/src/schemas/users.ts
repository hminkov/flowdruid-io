import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  initials: z.string().min(1).max(3),
  role: z.enum(['ADMIN', 'TEAM_LEAD', 'DEVELOPER']),
  teamId: z.string().optional(),
});

export const updateUserSchema = z.object({
  userId: z.string(),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'TEAM_LEAD', 'DEVELOPER']).optional(),
  teamId: z.string().nullable().optional(),
});

export const updateAvailabilitySchema = z.object({
  availability: z.enum(['AVAILABLE', 'BUSY', 'REMOTE', 'ON_LEAVE']),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;

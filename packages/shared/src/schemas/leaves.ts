import { z } from 'zod';

export const requestLeaveSchema = z.object({
  type: z.enum(['ANNUAL', 'PARTIAL_AM', 'PARTIAL_PM', 'REMOTE', 'SICK']),
  startDate: z.string(), // ISO date string
  endDate: z.string(),
  note: z.string().optional(),
  notifySlack: z.boolean().default(true),
});

export const listLeavesSchema = z.object({
  userId: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED']).optional(),
});

export const leaveCalendarSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  teamId: z.string().optional(),
});

export type RequestLeaveInput = z.infer<typeof requestLeaveSchema>;
export type ListLeavesInput = z.infer<typeof listLeavesSchema>;
export type LeaveCalendarInput = z.infer<typeof leaveCalendarSchema>;

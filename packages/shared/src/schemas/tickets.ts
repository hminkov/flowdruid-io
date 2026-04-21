import { z } from 'zod';

export const createTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  teamId: z.string(),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateTicketSchema = z.object({
  ticketId: z.string(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['TODO', 'BLOCKED', 'IN_PROGRESS', 'IN_REVIEW', 'READY_FOR_VERIFICATION', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  complexityPoints: z.number().int().min(1).max(10).nullable().optional(),
});

export const listTicketsSchema = z.object({
  teamId: z.string().optional(),
  status: z.enum(['TODO', 'BLOCKED', 'IN_PROGRESS', 'IN_REVIEW', 'READY_FOR_VERIFICATION', 'DONE']).optional(),
  source: z.enum(['INTERNAL', 'JIRA']).optional(),
  assigneeId: z.string().optional(),
  // Per-call override for the default per-column cap. Only honoured
  // when `status` is set (i.e. the caller is explicitly pulling a
  // single column's older items).
  limit: z.number().int().min(1).max(500).optional(),
});

export const assignTicketSchema = z.object({
  ticketId: z.string(),
  userId: z.string(),
  action: z.enum(['assign', 'unassign']),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsInput = z.infer<typeof listTicketsSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

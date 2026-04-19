import { z } from 'zod';

// ─── QA Environments ─────────────────────────────────────────────────────
export const qaBookingStatus = z.enum([
  'NEW',
  'IN_DEVELOPMENT',
  'TEST_IN_QA',
  'READY_FOR_PROD',
  'PUSHED_TO_PROD',
  'PAUSED',
]);

export const createQaBookingSchema = z.object({
  environmentId: z.string(),
  service: z.string().min(1),
  feature: z.string().optional(),
  devOwnerId: z.string().optional(),
  qaOwnerId: z.string().optional(),
  status: qaBookingStatus.default('IN_DEVELOPMENT'),
  notes: z.string().optional(),
  branch: z.string().optional(),
});

export const updateQaBookingSchema = z.object({
  bookingId: z.string(),
  service: z.string().min(1).optional(),
  feature: z.string().nullable().optional(),
  devOwnerId: z.string().nullable().optional(),
  qaOwnerId: z.string().nullable().optional(),
  status: qaBookingStatus.optional(),
  notes: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
});

export const deleteQaBookingSchema = z.object({
  bookingId: z.string(),
});

// ─── Parking ─────────────────────────────────────────────────────────────
export const listParkingSchema = z.object({
  startDate: z.string(), // ISO
  endDate: z.string(), // ISO
});

export const claimParkingSchema = z.object({
  spotId: z.string(),
  date: z.string(), // YYYY-MM-DD
  userId: z.string().optional(), // defaults to caller
});

export const releaseParkingSchema = z.object({
  spotId: z.string(),
  date: z.string(),
});

// ─── Prod Support ────────────────────────────────────────────────────────
export const listProdSupportSchema = z.object({
  teamId: z.string().optional(),
  year: z.number().int().optional(),
});

export const createProdSupportSchema = z.object({
  teamId: z.string(),
  startDate: z.string(), // YYYY-MM-DD Monday
  endDate: z.string(),
  weekNumber: z.number().int().min(1).max(53),
  primaryId: z.string(),
  secondaryId: z.string(),
});

export const deleteProdSupportSchema = z.object({
  assignmentId: z.string(),
});

export type QaBookingStatus = z.infer<typeof qaBookingStatus>;
export type CreateQaBookingInput = z.infer<typeof createQaBookingSchema>;
export type UpdateQaBookingInput = z.infer<typeof updateQaBookingSchema>;
export type CreateProdSupportInput = z.infer<typeof createProdSupportSchema>;
export type ListParkingInput = z.infer<typeof listParkingSchema>;
export type ClaimParkingInput = z.infer<typeof claimParkingSchema>;

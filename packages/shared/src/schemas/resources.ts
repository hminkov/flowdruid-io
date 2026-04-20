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
  clientTag: z.string().max(64).optional(),
  devOwnerId: z.string().optional(),
  qaOwnerId: z.string().optional(),
  status: qaBookingStatus.default('IN_DEVELOPMENT'),
  notes: z.string().optional(),
});

export const updateQaBookingSchema = z.object({
  bookingId: z.string(),
  service: z.string().min(1).optional(),
  feature: z.string().nullable().optional(),
  clientTag: z.string().max(64).nullable().optional(),
  devOwnerId: z.string().nullable().optional(),
  qaOwnerId: z.string().nullable().optional(),
  status: qaBookingStatus.optional(),
  notes: z.string().nullable().optional(),
});

export const deleteQaBookingSchema = z.object({
  bookingId: z.string(),
});

// ─── QA environments (admin/lead manage) ─────────────────────────────────
export const createQaEnvironmentSchema = z.object({
  name: z.string().min(1).max(64),
  branch: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  order: z.number().int().optional(),
});

export const updateQaEnvironmentSchema = z.object({
  environmentId: z.string(),
  name: z.string().min(1).max(64).optional(),
  branch: z.string().max(200).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().optional(),
});

export const deleteQaEnvironmentSchema = z.object({
  environmentId: z.string(),
});

// ─── Parking spots (admin manage) ────────────────────────────────────────
export const createParkingSpotSchema = z.object({
  name: z.string().min(1).max(32),
  order: z.number().int().optional(),
});

export const updateParkingSpotSchema = z.object({
  spotId: z.string(),
  name: z.string().min(1).max(32).optional(),
  order: z.number().int().optional(),
});

export const deleteParkingSpotSchema = z.object({
  spotId: z.string(),
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

export const autoScheduleMonthSchema = z.object({
  teamId: z.string(),
  startDate: z.string(), // YYYY-MM-DD Monday to start from
  weeks: z.number().int().min(1).max(12).default(4),
  overwrite: z.boolean().default(false),
});

export const requestCoverSchema = z.object({
  assignmentId: z.string(),
  reason: z.string().max(500).optional(),
});

export const acceptCoverSchema = z.object({
  coverRequestId: z.string(),
});

export const cancelCoverSchema = z.object({
  coverRequestId: z.string(),
});

export const listCoverRequestsSchema = z.object({
  teamId: z.string().optional(),
  openOnly: z.boolean().default(true),
});

export type QaBookingStatus = z.infer<typeof qaBookingStatus>;
export type CreateQaBookingInput = z.infer<typeof createQaBookingSchema>;
export type UpdateQaBookingInput = z.infer<typeof updateQaBookingSchema>;
export type CreateProdSupportInput = z.infer<typeof createProdSupportSchema>;
export type ListParkingInput = z.infer<typeof listParkingSchema>;
export type ClaimParkingInput = z.infer<typeof claimParkingSchema>;
export type AutoScheduleMonthInput = z.infer<typeof autoScheduleMonthSchema>;
export type RequestCoverInput = z.infer<typeof requestCoverSchema>;

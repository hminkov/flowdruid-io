import { z } from 'zod';

export const completeOnboardingSchema = z.object({
  workspaceName: z.string().min(1).max(80),
  // First team is optional — admins who only want to use Tickets +
  // Standups solo can skip and add teams later.
  teamName: z.string().min(1).max(60).optional(),
  // Each invite creates a User row; the invitee then completes their
  // own setup by signing in (Google match-by-email auto-links them
  // to the org, or they can use forgot-password to set a password).
  inviteEmails: z.array(z.string().email()).max(20).default([]),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

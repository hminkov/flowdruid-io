import { z } from 'zod';

export const createSuggestionSchema = z.object({
  ticketId: z.string(),
  suggestedUserId: z.string(),
  reason: z.string().max(500).optional(),
});

export const listSuggestionsSchema = z.object({
  ticketId: z.string(),
});

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
export type ListSuggestionsInput = z.infer<typeof listSuggestionsSchema>;

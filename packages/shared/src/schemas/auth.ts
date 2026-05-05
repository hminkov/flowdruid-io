import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const totpCodeSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, '6-digit code required'));

export const totpEnrollConfirmSchema = z.object({
  code: totpCodeSchema,
});

export type TotpEnrollConfirmInput = z.infer<typeof totpEnrollConfirmSchema>;

// Disabling 2FA: either prove possession of the second factor (a
// fresh code) or the password. Both are accepted.
export const totpDisableSchema = z.object({
  code: totpCodeSchema.optional(),
  password: z.string().min(1).optional(),
});

export type TotpDisableInput = z.infer<typeof totpDisableSchema>;

export const loginVerify2faSchema = z.object({
  partialToken: z.string().min(1),
  code: totpCodeSchema,
});

export type LoginVerify2faInput = z.infer<typeof loginVerify2faSchema>;

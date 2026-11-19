import { z } from 'zod';

export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  name: z.string().min(1).max(200).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RefreshInput = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof RefreshInput>;

export const VerifyEmailInput = z.object({
  token: z.string().min(10),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailInput>;

export const ResendVerificationInput = z.object({
  email: z.string().email(),
});
export type ResendVerificationInput = z.infer<typeof ResendVerificationInput>;

export const RequestPasswordResetInput = z.object({
  email: z.string().email(),
});
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetInput>;

export const ResetPasswordInput = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(10).max(200),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

export const GoogleLoginInput = z.object({
  idToken: z.string().min(10),
});
export type GoogleLoginInput = z.infer<typeof GoogleLoginInput>;

export const AuthResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable().optional(),
    emailVerifiedAt: z.string().nullable().optional(),
  }),
  workspaceId: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponse>;

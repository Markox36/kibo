import { api } from './api';
import type { AuthUser } from '../store/auth';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  workspaceId: string;
  user: AuthUser;
}

export const authApi = {
  register: (input: { email: string; password: string; name?: string }) =>
    api.post<AuthResponse>('/auth/register', input, { auth: false }),
  login: (input: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', input, { auth: false }),
  logout: (refreshToken: string) =>
    api.post<void>('/auth/logout', { refreshToken }, { auth: false }),
  resendVerification: (email: string) =>
    api.post<{ ok: true }>('/auth/resend-verification', { email }, { auth: false }),
  requestReset: (email: string) =>
    api.post<{ ok: true }>('/auth/request-password-reset', { email }, { auth: false }),
  resetPassword: (token: string, newPassword: string) =>
    api.post<{ ok: true }>('/auth/reset-password', { token, newPassword }, { auth: false }),
  google: (idToken: string) => api.post<AuthResponse>('/auth/google', { idToken }, { auth: false }),
  me: () => api.get<AuthUser & { workspaceId: string }>('/me'),
};

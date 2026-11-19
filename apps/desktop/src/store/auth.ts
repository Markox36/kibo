import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authStorage } from '../lib/auth-persistence';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  emailVerifiedAt?: string | null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  workspaceId: string | null;
  user: AuthUser | null;
  setSession: (s: {
    accessToken: string;
    refreshToken: string;
    workspaceId: string;
    user: AuthUser;
  }) => void;
  setTokens: (t: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      workspaceId: null,
      user: null,
      setSession: (s) =>
        set({
          accessToken: s.accessToken,
          refreshToken: s.refreshToken,
          workspaceId: s.workspaceId,
          user: s.user,
        }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      clear: () =>
        set({ accessToken: null, refreshToken: null, workspaceId: null, user: null }),
    }),
    {
      name: 'kibo.auth',
      storage: createJSONStorage(() => authStorage),
    },
  ),
);

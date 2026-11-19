import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../lib/secure-storage';

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
  hydrated: boolean;
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
      hydrated: false,
      setSession: (s) =>
        set({
          accessToken: s.accessToken,
          refreshToken: s.refreshToken,
          workspaceId: s.workspaceId,
          user: s.user,
        }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, workspaceId: null, user: null }),
    }),
    {
      name: 'kibo.auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        workspaceId: s.workspaceId,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        // mark hydration complete so the router can decide auth vs app once storage loaded
        if (state) state.hydrated = true;
        useAuthStore.setState({ hydrated: true });
      },
    },
  ),
);

export const isAuthenticated = () => !!useAuthStore.getState().accessToken;

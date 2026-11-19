import { create } from 'zustand';

export type SidebarState = 'expanded' | 'collapsed' | 'focus';

interface UiState {
  sidebarState: SidebarState;
  mobileNavOpen: boolean;
  setSidebar: (s: SidebarState) => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (v: boolean) => void;
  toggleMobileNav: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarState: 'expanded',
  mobileNavOpen: false,
  setSidebar: (sidebarState) => set({ sidebarState }),
  toggleSidebar: () =>
    set({ sidebarState: get().sidebarState === 'expanded' ? 'collapsed' : 'expanded' }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  toggleMobileNav: () => set({ mobileNavOpen: !get().mobileNavOpen }),
}));

import { LazyStore } from '@tauri-apps/plugin-store';
import type { StateStorage } from 'zustand/middleware';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let tauriStore: LazyStore | null = null;
function store(): LazyStore {
  if (!tauriStore) tauriStore = new LazyStore('kibo-auth.json', { defaults: {}, autoSave: true });
  return tauriStore;
}

export const authStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isTauri) {
      try {
        const v = await store().get<string>(name);
        if (typeof v === 'string') return v;
      } catch {
        /* fall through */
      }
    }
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
    if (isTauri) {
      try {
        await store().set(name, value);
      } catch {
        /* ignore */
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
    if (isTauri) {
      try {
        await store().delete(name);
      } catch {
        /* ignore */
      }
    }
  },
};

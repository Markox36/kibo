import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

// zustand persist adapter backed by the OS keystore (Android Keystore / iOS Keychain).
// SecureStore keys must match [A-Za-z0-9._-]; the store name "kibo.auth" is valid.
export const secureStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      /* ignore write failures — session simply won't persist */
    }
  },
  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      /* ignore */
    }
  },
};

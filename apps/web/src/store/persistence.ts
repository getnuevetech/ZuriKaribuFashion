import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const memoryStorage = new Map<string, string>();

const resolveLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    if (window.localStorage) return window.localStorage;
  } catch {
    // Access can throw in private/restricted mobile browsers.
  }
  return null;
};

const safeStateStorage: StateStorage = {
  getItem: (name) => {
    const fallback = memoryStorage.get(name) ?? null;
    const localStorage = resolveLocalStorage();
    if (!localStorage) return fallback;
    try {
      const value = localStorage.getItem(name);
      if (typeof value === 'string') {
        memoryStorage.set(name, value);
      }
      return value;
    } catch {
      return fallback;
    }
  },
  setItem: (name, value) => {
    memoryStorage.set(name, value);
    const localStorage = resolveLocalStorage();
    if (!localStorage) return;
    try {
      localStorage.setItem(name, value);
    } catch {
      // Storage quota/security errors should never crash the app.
    }
  },
  removeItem: (name) => {
    memoryStorage.delete(name);
    const localStorage = resolveLocalStorage();
    if (!localStorage) return;
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore storage removal failures in restricted environments.
    }
  },
};

export const safePersistStorage = createJSONStorage(() => safeStateStorage);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { googleLogout } from '@react-oauth/google';
import type { User, AuthState } from '../types';
import { safePersistStorage } from './persistence';

interface AuthStore extends AuthState {
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user }),
      
      setToken: (token) => set({ token }),
      
      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      }),
      
      logout: () => {
        try {
          if (typeof window !== 'undefined') {
            googleLogout();
          }
        } catch {
          // Ignore Google session cleanup failures.
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
      
      setLoading: (isLoading) => set({ isLoading }),
      
      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } : null,
      })),
    }),
    {
      name: 'auth-storage',
      storage: safePersistStorage,
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const hasToken = Boolean(String(state.token || '').trim());
        state.isAuthenticated = hasToken;
        if (!hasToken) {
          state.user = null;
        }
      },
    }
  )
);

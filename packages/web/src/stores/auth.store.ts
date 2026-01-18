import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'owner' | 'manager' | 'worker' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  farmId: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
  };
}

export interface Farm {
  id: string;
  name: string;
  timezone: string;
}

interface AuthState {
  user: User | null;
  farm: Farm | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  
  // Actions
  setAuth: (data: {
    user: User;
    farm: Farm;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setFarm: (farm: Farm) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      farm: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,

      setAuth: ({ user, farm, accessToken, refreshToken }) =>
        set({
          user,
          farm,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user }),

      setFarm: (farm) => set({ farm }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () =>
        set({
          user: null,
          farm: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'farm-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        farm: state.farm,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // After hydration, set loading to false if we have auth data
        // or if there's no stored auth data
        if (state) {
          state.setHasHydrated(true);
          // If we have persisted auth data, we still need to validate the token
          // so keep isLoading true until useAuthInit validates
          if (!state.accessToken) {
            state.setLoading(false);
          }
        }
      },
    }
  )
);

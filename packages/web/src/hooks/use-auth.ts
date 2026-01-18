import { useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuthStore, User, Farm } from '@/stores/auth.store';
import { useToast } from '@/components/ui/use-toast';

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  farm: Farm;
}

interface MeResponse {
  user: User;
  farm: Farm;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      return apiClient.post<LoginResponse>('/auth/login', credentials);
    },
    onSuccess: (data) => {
      setAuth({
        user: data.user,
        farm: data.farm,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      toast({
        title: 'Welcome back!',
        description: `Logged in as ${data.user.profile.firstName}`,
      });
      navigate('/dashboard');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message || 'Invalid email or password',
      });
    },
  });
}

export function useLogout() {
  const { logout, accessToken } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (accessToken) {
        try {
          await apiClient.post('/auth/logout');
        } catch {
          // Ignore logout errors - we'll clear local state anyway
        }
      }
    },
    onSettled: () => {
      logout();
      queryClient.clear();
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully',
      });
      navigate('/login');
    },
  });
}

export function useRefreshToken() {
  const { refreshToken, setTokens, logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      return apiClient.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { refreshToken }
      );
    },
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
    },
    onError: () => {
      logout();
    },
  });
}

/**
 * Hook to initialize auth state on app startup.
 * Validates stored tokens and fetches current user data.
 */
export function useAuthInit() {
  const { 
    accessToken, 
    setAuth, 
    setLoading, 
    logout, 
    _hasHydrated,
    isAuthenticated 
  } = useAuthStore();

  const { refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      return apiClient.get<MeResponse>('/auth/me');
    },
    enabled: false, // Don't auto-fetch, we'll trigger manually
    retry: false,
  });

  const initAuth = useCallback(async () => {
    // If no token stored, mark as not loading and return
    if (!accessToken) {
      setLoading(false);
      return;
    }

    try {
      const result = await refetch();
      if (result.data) {
        // Token is valid, update user/farm data
        setAuth({
          user: result.data.user,
          farm: result.data.farm,
          accessToken,
          refreshToken: useAuthStore.getState().refreshToken || '',
        });
      }
    } catch {
      // Token is invalid, clear auth state
      logout();
    }
  }, [accessToken, refetch, setAuth, setLoading, logout]);

  useEffect(() => {
    // Wait for hydration to complete before initializing
    if (!_hasHydrated) {
      return;
    }

    // If we have a token but need to validate it
    if (accessToken && !isAuthenticated) {
      initAuth();
    } else if (accessToken && isAuthenticated) {
      // Already authenticated from persisted state, just mark as not loading
      setLoading(false);
    } else if (!accessToken) {
      // No token, mark as not loading
      setLoading(false);
    }
  }, [_hasHydrated, accessToken, isAuthenticated, initAuth, setLoading]);
}

/**
 * Hook to get current auth state
 */
export function useAuth() {
  const { user, farm, isAuthenticated, isLoading } = useAuthStore();
  return { user, farm, isAuthenticated, isLoading };
}

import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useRefreshTimer, useTaskStore } from '@/stores/useTaskStore';

/**
 * Hook to initialize timer store with user and set up initial state.
 *
 * Uses `useRefreshTimer` (a single-function stable selector) instead of
 * `useTimerActions` (which returned a new object every render and caused
 * an infinite useSyncExternalStore loop).
 */
export function useTimerInit() {
    const { user } = useAuth();
    // Stable selector — returns a single function reference, never a new object
    const refreshTimer = useRefreshTimer();
    const setUser = useTaskStore((state: any) => state.setUser);

    useEffect(() => {
        // Keep the store's internal _user in sync so syncWithRealtime can
        // call refreshTimer without needing the caller to pass `user`.
        setUser(user ?? null);
        if (user) {
            // Initialize timer state when user logs in
            refreshTimer(user);
        }
        // refreshTimer and setUser are Zustand actions: stable references across renders
    }, [user, refreshTimer, setUser]);
}

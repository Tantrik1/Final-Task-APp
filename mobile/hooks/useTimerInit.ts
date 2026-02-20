import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useRefreshTimer } from '@/stores/useTaskStore';

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

    useEffect(() => {
        if (user) {
            // Initialize timer state when user logs in
            refreshTimer(user);
        }
        // refreshTimer is a Zustand action: same reference across renders (store functions are stable)
    }, [user, refreshTimer]);
}

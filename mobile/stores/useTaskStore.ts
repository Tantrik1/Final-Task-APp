import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface ActiveTimer {
    task_id: string;
    task_title: string;
    project_name: string;
    session_id: string;
    started_at: string;
    total_work_time: number;
}

interface TaskState {
    activeTimer: ActiveTimer | null;
    isTimerRunning: boolean;
    isLoading: boolean;
    error: string | null;
    // Stored user so internal actions (e.g. syncWithRealtime) don't need it passed in
    _user: User | null;

    // Actions
    setUser: (user: User | null) => void;
    toggleTimer: (taskId: string, user: User) => Promise<void>;
    stopTimer: (taskId: string, user: User) => Promise<void>;
    refreshTimer: (user: User) => Promise<void>;
    syncWithRealtime: (payload: any, user: User) => void;
    clearError: () => void;
}

export const useTaskStore = create<TaskState>((set: any, get: any) => ({
    activeTimer: null,
    isTimerRunning: false,
    isLoading: false,
    error: null,
    _user: null,

    setUser: (user: User | null) => set({ _user: user }),

    toggleTimer: async (taskId: string, user: User) => {
        if (!user) {
            set({ error: 'User not authenticated' });
            return;
        }

        const previousState = get();
        const previousTimer = previousState.activeTimer;

        // --- OPTIMISTIC UI UPDATE (< 100ms) ---
        // If starting a new timer, optimistically set it as active
        const isStartingNewTimer = previousTimer?.task_id !== taskId;

        if (isStartingNewTimer) {
            // Optimistic update: assume timer will start
            set({
                isLoading: true,
                error: null,
                activeTimer: {
                    task_id: taskId,
                    task_title: 'Loading...', // Will be updated with real data
                    project_name: 'Loading...',
                    session_id: '',
                    started_at: new Date().toISOString(),
                    total_work_time: 0,
                },
                isTimerRunning: true,
            });
        }

        // --- DATABASE SYNC ---
        try {
            const { data, error } = await supabase.rpc('toggle_task_timer_optimized', {
                target_task_id: taskId,
                current_user_id: user.id,
            });

            if (error) throw error;

            const result = data?.[0];
            if (!result) {
                throw new Error('No data returned from toggle timer');
            }

            // Update with real data from database
            set({
                activeTimer: {
                    task_id: result.task_id,
                    task_title: result.task_title,
                    project_name: result.project_name,
                    session_id: result.session_id,
                    started_at: result.started_at,
                    total_work_time: result.total_work_time,
                },
                isTimerRunning: true,
                isLoading: false,
                error: null,
            });

            // Log status change if it happened
            if (result.status_changed) {
                console.log(`[Timer] Status auto-changed: ${result.old_status} → ${result.new_status}`);
            }

        } catch (error) {
            console.error('[Timer] Toggle error:', error);

            // Rollback on failure
            set({
                activeTimer: previousTimer,
                isTimerRunning: !!previousTimer,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to toggle timer',
            });
        }
    },

    stopTimer: async (taskId: string, user: User) => {
        if (!user) {
            set({ error: 'User not authenticated' });
            return;
        }

        const previousState = get();
        const previousTimer = previousState.activeTimer;

        // --- OPTIMISTIC UI UPDATE (< 100ms) ---
        set({
            isLoading: true,
            error: null,
            activeTimer: null,
            isTimerRunning: false,
        });

        // --- DATABASE SYNC ---
        try {
            const { data, error } = await supabase.rpc('stop_task_timer_optimized', {
                target_task_id: taskId,
                current_user_id: user.id,
            });

            if (error) throw error;

            // State already updated optimistically, just ensure no error
            set({
                isLoading: false,
                error: null,
            });

        } catch (error) {
            console.error('[Timer] Stop error:', error);

            // Rollback on failure
            set({
                activeTimer: previousTimer,
                isTimerRunning: !!previousTimer,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to stop timer',
            });
        }
    },

    refreshTimer: async (user: User) => {
        if (!user) return;

        try {
            const { data, error } = await supabase.rpc('get_active_timer');
            if (error) throw error;

            const timer = data?.[0] ?? null;
            set({
                activeTimer: timer,
                isTimerRunning: !!timer,
                error: null,
            });
        } catch (error) {
            console.error('[Timer] Refresh error:', error);
            set({
                error: error instanceof Error ? error.message : 'Failed to refresh timer',
                activeTimer: null,
                isTimerRunning: false,
            });
        }
    },

    syncWithRealtime: (payload: any, user: User) => {
        // Use passed user or fall back to stored _user
        const resolvedUser = user || get()._user;
        if (!resolvedUser) return;

        const updatedTask = payload.new;
        const currentState = get();

        // If this update affects the current user's timer
        if (updatedTask.assigned_to === resolvedUser.id || updatedTask.created_by === resolvedUser.id) {
            if (updatedTask.is_timer_running) {
                // Task started running - check if it's the active one
                if (currentState.activeTimer?.task_id === updatedTask.id) {
                    // Update existing active timer with new data
                    set({
                        activeTimer: {
                            ...currentState.activeTimer,
                            task_title: updatedTask.title,
                            total_work_time: updatedTask.total_work_time || 0,
                        },
                        isTimerRunning: true,
                    });
                } else {
                    // New timer started, fetch full details — use resolvedUser so refreshTimer gets a valid user
                    get().refreshTimer(resolvedUser);
                }
            } else {
                // Timer stopped
                if (currentState.activeTimer?.task_id === updatedTask.id) {
                    set({
                        activeTimer: null,
                        isTimerRunning: false,
                    });
                }
            }
        }
    },

    clearError: () => set({ error: null }),
}));

// Selector hooks for optimized re-renders
// Each selector returns a primitive or stable function reference — no new objects created.
// IMPORTANT: Never return a new object literal `{}` from a Zustand selector — it creates
// a new reference every render and causes useSyncExternalStore to loop infinitely.
export const useActiveTimer = () => useTaskStore((state: any) => state.activeTimer);
export const useIsTimerRunning = () => useTaskStore((state: any) => state.isTimerRunning);

// Individual stable action selectors (each returns a single, stable function reference)
export const useToggleTimer = () => useTaskStore((state: any) => state.toggleTimer);
export const useStopTimer = () => useTaskStore((state: any) => state.stopTimer);
export const useRefreshTimer = () => useTaskStore((state: any) => state.refreshTimer);
export const useSyncWithRealtime = () => useTaskStore((state: any) => state.syncWithRealtime);
export const useClearError = () => useTaskStore((state: any) => state.clearError);

// Combined actions hook — uses useShallow so Zustand compares each key individually
// instead of doing a reference equality check on the whole object (which always fails).
export const useTimerActions = () => useTaskStore(
    useShallow((state: any) => ({
        toggleTimer: state.toggleTimer,
        stopTimer: state.stopTimer,
        refreshTimer: state.refreshTimer,
        syncWithRealtime: state.syncWithRealtime,
        clearError: state.clearError,
    }))
);

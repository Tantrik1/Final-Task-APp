import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface TaskSession {
    id: string;
    task_id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    session_type?: 'start' | 'resume';
}

// ─── Timer State Machine ────────────────────────────────────────────
// IDLE ──[play]──▶ RUNNING ──[pause]──▶ PAUSED ──[resume]──▶ RUNNING
//                     │                    │
//                  [stop]               [stop]     → closes session, no status change
//                  [complete]           [complete]  → closes session, moves to done
//                     ▼                    ▼
//                   IDLE                  IDLE / COMPLETED

export type TimerPhase = 'idle' | 'running' | 'paused' | 'completed';

interface TaskTimerState {
    phase: TimerPhase;
    isRunning: boolean;
    totalWorkTime: number;
    currentSessionStart: Date | null;
    sessions: TaskSession[];
    firstStartedAt: Date | null;
    completedAt: Date | null;
    currentStatusCategory: string | null;
}

interface ProjectStatus {
    id: string;
    name: string;
    category: string;
    is_default: boolean;
    is_completed: boolean;
}

export function useTaskTimer(taskId: string, completedStatusId?: string) {
    const { user } = useAuth();
    const [state, setState] = useState<TaskTimerState>({
        phase: 'idle',
        isRunning: false,
        totalWorkTime: 0,
        currentSessionStart: null,
        sessions: [],
        firstStartedAt: null,
        completedAt: null,
        currentStatusCategory: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [projectStatuses, setProjectStatuses] = useState<ProjectStatus[]>([]);

    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    const projectStatusesRef = useRef<ProjectStatus[]>([]);
    useEffect(() => { projectStatusesRef.current = projectStatuses; }, [projectStatuses]);
    const isBusy = useRef(false);

    // ─── Fetch all data ─────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!taskId) return;

        try {
            const [taskResult, sessionsResult] = await Promise.all([
                supabase
                    .from('tasks')
                    .select('project_id, custom_status_id, first_started_at, completed_at, total_work_time, is_timer_running')
                    .eq('id', taskId)
                    .maybeSingle(),
                supabase
                    .from('task_work_sessions')
                    .select('*')
                    .eq('task_id', taskId)
                    .order('started_at', { ascending: false }),
            ]);

            if (taskResult.error) throw taskResult.error;
            const task = taskResult.data;
            if (!task) return;

            // Fetch project statuses for auto-transitions
            const { data: statuses } = await supabase
                .from('project_statuses')
                .select('id, name, category, is_default, is_completed')
                .eq('project_id', task.project_id)
                .order('position');
            setProjectStatuses(statuses || []);

            // Determine current status category
            const currentStatus = (statuses || []).find(s => s.id === task.custom_status_id);
            const currentCategory = currentStatus?.category || null;

            const sessionsRaw = (sessionsResult.data || []) as any[];
            const sessions: TaskSession[] = sessionsRaw.reverse().map((s, idx) => ({
                ...s,
                session_type: idx === 0 ? 'start' : 'resume',
            })).reverse();

            // Derive running state from open session (source of truth, not denormalized field)
            const openSession = sessions.find(s => !s.ended_at);
            const isRunning = !!openSession;

            // Derive phase
            let phase: TimerPhase = 'idle';
            if (currentCategory === 'done' || currentCategory === 'cancelled') {
                phase = 'completed';
            } else if (isRunning) {
                phase = 'running';
            } else if (sessions.length > 0 && !openSession) {
                phase = 'paused';
            }

            setState({
                phase,
                isRunning,
                totalWorkTime: task.total_work_time || 0,
                currentSessionStart: openSession ? new Date(openSession.started_at) : null,
                sessions,
                firstStartedAt: task.first_started_at ? new Date(task.first_started_at) : null,
                completedAt: task.completed_at ? new Date(task.completed_at) : null,
                currentStatusCategory: currentCategory,
            });
        } catch (error) {
            console.error('[Timer] Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [taskId]);

    // ─── Realtime subscription ──────────────────────────────────────
    useEffect(() => {
        fetchData();
        if (!taskId) return;

        const channel = supabase
            .channel(`timer-${taskId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, (payload) => {
                console.log('[Timer] Task changed via realtime');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_work_sessions', filter: `task_id=eq.${taskId}` }, () => {
                console.log('[Timer] Session changed via realtime');
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [taskId, fetchData]);

    // ─── Tick every second when running ─────────────────────────────
    useEffect(() => {
        if (!state.isRunning || !state.currentSessionStart) {
            setElapsedTime(0);
            return;
        }
        // Immediate calc
        setElapsedTime(Math.floor((Date.now() - state.currentSessionStart.getTime()) / 1000));

        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - state.currentSessionStart!.getTime()) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [state.isRunning, state.currentSessionStart]);

    // ─── Helper: close open session ─────────────────────────────────
    const closeOpenSession = async (): Promise<number> => {
        // BUG-07 FIX: Guard against empty taskId
        if (!taskId) return 0;
        const openSession = stateRef.current.sessions.find(s => !s.ended_at);
        if (!openSession || !stateRef.current.currentSessionStart) return 0;

        // C-02 FIX: Use atomic RPC instead of non-atomic read→add→write.
        // close_task_session atomically: closes the session row AND increments
        // total_work_time in a single DB transaction — no race condition.
        if (user) {
            const { data, error } = await supabase.rpc('close_task_session', {
                p_task_id: taskId,
                p_user_id: user.id,
            });
            if (error) {
                console.error('[Timer] close_task_session RPC error:', error);
                return 0;
            }
            return (data as number) ?? 0;
        }

        // Fallback when user is unavailable: manual session close (no work-time update)
        const now = new Date();
        const duration = Math.floor((now.getTime() - stateRef.current.currentSessionStart.getTime()) / 1000);
        await supabase.from('task_work_sessions').update({
            ended_at: now.toISOString(),
            duration_seconds: duration,
        }).eq('id', openSession.id);
        await supabase.from('tasks').update({ is_timer_running: false }).eq('id', taskId);
        return duration;
    };

    // ─── Helper: auto-move to active status ─────────────────────────
    const autoMoveToActive = async () => {
        const cat = stateRef.current.currentStatusCategory;
        if (cat === 'todo' || cat === null) {
            const activeStatus = projectStatusesRef.current.find(s => s.category === 'active');
            if (activeStatus) {
                console.log('[Timer] Auto-moving task to active status:', activeStatus.name);
                await supabase.from('tasks').update({ custom_status_id: activeStatus.id }).eq('id', taskId);
            }
        }
    };

    // ═════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═════════════════════════════════════════════════════════════════

    /** ▶ PLAY — Start timer from idle. Auto-moves task to active status. */
    const startTimer = async () => {
        if (!user || isBusy.current) return;
        isBusy.current = true;
        console.log('[Timer] ▶ START');

        try {
            const now = new Date().toISOString();

            // Close any stale open session first (safety net)
            await closeOpenSession();

            // Auto-move to active status if in todo
            await autoMoveToActive();

            // Set timer running on task
            await supabase.from('tasks').update({ is_timer_running: true }).eq('id', taskId);

            // Create work session
            await supabase.from('task_work_sessions').insert({
                task_id: taskId,
                user_id: user.id,
                started_at: now,
            });

            await fetchData();
        } catch (error) {
            console.error('[Timer] Start error:', error);
            Alert.alert('Error', 'Failed to start timer');
        } finally {
            isBusy.current = false;
        }
    };

    /** ⏸ PAUSE — Pause timer, close session. Status stays the same. Returns session duration. */
    const pauseTimer = async (): Promise<number> => {
        if (!user || !stateRef.current.isRunning || isBusy.current) return 0;
        isBusy.current = true;
        console.log('[Timer] ⏸ PAUSE');

        try {
            const duration = await closeOpenSession();
            await fetchData();
            return duration;
        } catch (error) {
            console.error('[Timer] Pause error:', error);
            Alert.alert('Error', 'Failed to pause timer');
            return 0;
        } finally {
            isBusy.current = false;
        }
    };

    /** ▶ RESUME — Resume from paused state. Does NOT change status. */
    const resumeTimer = async () => {
        if (!user || isBusy.current) return;
        isBusy.current = true;
        console.log('[Timer] ▶ RESUME');

        try {
            const now = new Date().toISOString();
            await supabase.from('tasks').update({ is_timer_running: true }).eq('id', taskId);
            await supabase.from('task_work_sessions').insert({
                task_id: taskId,
                user_id: user.id,
                started_at: now,
            });
            await fetchData();
        } catch (error) {
            console.error('[Timer] Resume error:', error);
            Alert.alert('Error', 'Failed to resume timer');
        } finally {
            isBusy.current = false;
        }
    };

    /** ⏹ STOP — Stop timer completely, reset to idle. Does NOT change status. */
    const stopTimer = async (): Promise<number> => {
        if (!user || isBusy.current) return 0;
        isBusy.current = true;
        console.log('[Timer] ⏹ STOP');

        try {
            // Close open session if running (closeOpenSession already sets is_timer_running: false)
            const duration = stateRef.current.isRunning ? await closeOpenSession() : 0;
            // Ensure is_timer_running is false even if already paused
            await supabase.from('tasks').update({ is_timer_running: false }).eq('id', taskId);
            await fetchData();
            return duration;
        } catch (error) {
            console.error('[Timer] Stop error:', error);
            Alert.alert('Error', 'Failed to stop timer');
            return 0;
        } finally {
            isBusy.current = false;
        }
    };

    /** ✓ COMPLETE — Stop timer and mark task as done via custom_status_id. */
    const completeTask = async () => {
        if (!user || isBusy.current) return;
        isBusy.current = true;
        console.log('[Timer] ✓ COMPLETE');

        try {
            // Close any open session first (use stateRef to avoid stale closure)
            if (stateRef.current.isRunning) {
                await closeOpenSession();
            }

            // Move to completed status — only write custom_status_id
            // DB trigger handles: status enum, completed_at, first_started_at
            if (completedStatusId) {
                await supabase.from('tasks').update({
                    custom_status_id: completedStatusId,
                }).eq('id', taskId);
            } else {
                // Fallback: find done status from project
                const doneStatus = projectStatusesRef.current.find(s => s.category === 'done' || s.is_completed);
                if (doneStatus) {
                    await supabase.from('tasks').update({
                        custom_status_id: doneStatus.id,
                    }).eq('id', taskId);
                }
            }

            await fetchData();
        } catch (error) {
            console.error('[Timer] Complete error:', error);
            Alert.alert('Error', 'Failed to complete task');
        } finally {
            isBusy.current = false;
        }
    };

    /** 🗑 DELETE SESSION — Remove a session and adjust total_work_time. */
    const deleteSession = async (sessionId: string) => {
        try {
            const session = stateRef.current.sessions.find(s => s.id === sessionId);
            if (!session) return;

            // If deleting the active session, clear the timer flag
            if (!session.ended_at) {
                await supabase.from('tasks').update({ is_timer_running: false }).eq('id', taskId);
            }

            // C-02 FIX: Use atomic RPC to subtract duration — eliminates read-add-write race.
            if (session.duration_seconds && session.duration_seconds > 0) {
                await supabase.rpc('adjust_task_work_time', {
                    p_task_id: taskId,
                    p_delta: -session.duration_seconds,
                });
            }

            await supabase.from('task_work_sessions').delete().eq('id', sessionId);
            await fetchData();
        } catch (error) {
            console.error('[Timer] Delete session error:', error);
            Alert.alert('Error', 'Failed to delete session');
        }
    };

    // ─── Formatters ─────────────────────────────────────────────────
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m`;
        return '<1m';
    };

    const formatTimeWithSeconds = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const formatTimeLive = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${m}:${pad(s)}`;
    };

    return {
        ...state,
        elapsedTime,
        displayTime: state.totalWorkTime + elapsedTime,
        isLoading,
        projectStatuses,
        // Actions
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        completeTask,
        deleteSession,
        // Formatters
        formatTime,
        formatTimeWithSeconds,
        formatTimeLive,
        refresh: fetchData,
    };
}

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

interface TaskTimerState {
    isRunning: boolean;
    totalWorkTime: number; // in seconds
    currentSessionStart: Date | null;
    sessions: TaskSession[];
    firstStartedAt: Date | null;
    completedAt: Date | null;
}

export function useTaskTimer(taskId: string, completedStatusId?: string) {
    const { user } = useAuth();
    const [state, setState] = useState<TaskTimerState>({
        isRunning: false,
        totalWorkTime: 0,
        currentSessionStart: null,
        sessions: [],
        firstStartedAt: null,
        completedAt: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Ref to track state for background updates
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const fetchData = useCallback(async () => {
        if (!taskId) return;

        try {
            const [taskResult, sessionsResult] = await Promise.all([
                supabase
                    .from('tasks')
                    .select('first_started_at, completed_at, total_work_time, is_timer_running')
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

            const sessionsRaw = (sessionsResult.data || []) as any[];
            // Enrich sessions with session_type
            const sessions: TaskSession[] = sessionsRaw.reverse().map((s, idx) => ({
                ...s,
                session_type: idx === 0 ? 'start' : 'resume',
            })).reverse();

            const openSession = sessions.find(s => !s.ended_at);

            setState({
                isRunning: task.is_timer_running || false,
                totalWorkTime: task.total_work_time || 0,
                currentSessionStart: openSession ? new Date(openSession.started_at) : null,
                sessions,
                firstStartedAt: task.first_started_at ? new Date(task.first_started_at) : null,
                completedAt: task.completed_at ? new Date(task.completed_at) : null,
            });
        } catch (error) {
            console.error('[useTaskTimer] Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [taskId]);

    // Initial fetch and subscription
    useEffect(() => {
        fetchData();

        if (!taskId) return;

        const channel = supabase
            .channel(`timer-${taskId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, () => {
                console.log('[Timer] Task updated, refreshing...');
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_work_sessions', filter: `task_id=eq.${taskId}` }, () => {
                console.log('[Timer] Sessions updated, refreshing...');
                fetchData();
            })
            .subscribe();

        return () => {
            console.log('[Timer] Unsubscribing...');
            supabase.removeChannel(channel);
        };
    }, [taskId, fetchData]);

    // Update elapsed time every second when running
    useEffect(() => {
        if (!state.isRunning || !state.currentSessionStart) {
            setElapsedTime(0);
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - state.currentSessionStart!.getTime()) / 1000);
            setElapsedTime(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [state.isRunning, state.currentSessionStart]);

    const startTimer = async () => {
        if (!user) return;
        console.log('[Timer] Starting timer...');

        try {
            const now = new Date().toISOString();
            const isFirstStart = !state.firstStartedAt;

            // Update task
            const { error: taskError } = await supabase
                .from('tasks')
                .update({
                    is_timer_running: true,
                    ...(isFirstStart && { first_started_at: now }),
                })
                .eq('id', taskId);

            if (taskError) throw taskError;

            // Create session
            const { error: sessionError } = await supabase
                .from('task_work_sessions')
                .insert({
                    task_id: taskId,
                    user_id: user.id,
                    started_at: now,
                });

            if (sessionError) throw sessionError;
            await fetchData();
        } catch (error) {
            console.error('[Timer] Start error:', error);
            Alert.alert('Error', 'Failed to start timer');
        }
    };

    const pauseTimer = async (): Promise<number> => {
        if (!user || !state.currentSessionStart) return 0;
        console.log('[Timer] Pausing timer...');

        try {
            const now = new Date();
            const sessionDuration = Math.floor((now.getTime() - state.currentSessionStart.getTime()) / 1000);

            // Fetch latest task data to avoid drift
            const { data: latestTask } = await supabase
                .from('tasks')
                .select('total_work_time')
                .eq('id', taskId)
                .single();

            const currentTotal = latestTask?.total_work_time || 0;

            // Close session
            const openSession = state.sessions.find(s => !s.ended_at);
            if (openSession) {
                await supabase
                    .from('task_work_sessions')
                    .update({
                        ended_at: now.toISOString(),
                        duration_seconds: sessionDuration,
                    })
                    .eq('id', openSession.id);
            }

            // Update task
            await supabase
                .from('tasks')
                .update({
                    is_timer_running: false,
                    total_work_time: currentTotal + sessionDuration,
                })
                .eq('id', taskId);

            await fetchData();
            return sessionDuration;
        } catch (error) {
            console.error('[Timer] Pause error:', error);
            Alert.alert('Error', 'Failed to pause timer');
            return 0;
        }
    };

    const resumeTimer = async () => {
        if (!user) return;
        console.log('[Timer] Resuming timer...');
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
        }
    };

    const completeTask = async () => {
        if (!user) return;
        console.log('[Timer] Completing task...');

        try {
            const now = new Date();

            // Fetch latest task data
            const { data: latestTask } = await supabase
                .from('tasks')
                .select('total_work_time')
                .eq('id', taskId)
                .single();

            let finalTotal = latestTask?.total_work_time || 0;

            const openSession = state.sessions.find(s => !s.ended_at);
            if (openSession && state.currentSessionStart) {
                const sessionDuration = Math.floor((now.getTime() - state.currentSessionStart.getTime()) / 1000);
                finalTotal += sessionDuration;

                await supabase
                    .from('task_work_sessions')
                    .update({
                        ended_at: now.toISOString(),
                        duration_seconds: sessionDuration,
                    })
                    .eq('id', openSession.id);
            }

            const updateData: any = {
                is_timer_running: false,
                completed_at: now.toISOString(),
                total_work_time: finalTotal,
            };
            if (completedStatusId) updateData.custom_status_id = completedStatusId;

            await supabase.from('tasks').update(updateData).eq('id', taskId);
            await fetchData();
        } catch (error) {
            console.error('[Timer] Complete error:', error);
        }
    };

    const deleteSession = async (sessionId: string) => {
        try {
            const session = state.sessions.find(s => s.id === sessionId);
            if (!session) return;

            if (!session.ended_at) {
                await supabase.from('tasks').update({ is_timer_running: false }).eq('id', taskId);
            }

            if (session.duration_seconds) {
                const { data: latest } = await supabase.from('tasks').select('total_work_time').eq('id', taskId).single();
                const currentTotal = latest?.total_work_time || 0;
                await supabase.from('tasks').update({
                    total_work_time: Math.max(0, currentTotal - session.duration_seconds)
                }).eq('id', taskId);
            }

            await supabase.from('task_work_sessions').delete().eq('id', sessionId);
            await fetchData();
        } catch (error) {
            console.error('[Timer] Delete session error:', error);
        }
    };

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
        startTimer,
        pauseTimer,
        resumeTimer,
        completeTask,
        deleteSession,
        formatTime,
        formatTimeWithSeconds,
        formatTimeLive,
        refresh: fetchData,
    };
}

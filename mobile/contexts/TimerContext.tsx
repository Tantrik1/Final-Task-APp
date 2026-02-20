import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ActiveTimer {
    task_id: string;
    task_title: string;
    project_name: string;
    session_id: string;
    started_at: string;
    total_work_time: number;
}

interface TimerContextType {
    activeTimer: ActiveTimer | null;
    isTimerRunning: boolean;
    refreshTimer: () => void;
}

const TimerContext = createContext<TimerContextType>({
    activeTimer: null,
    isTimerRunning: false,
    refreshTimer: () => {},
});

export function TimerProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    const fetchActiveTimer = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase.rpc('get_active_timer');
            if (error) throw error;
            const timer = data?.[0] ?? null;
            setActiveTimer(timer);
            setIsTimerRunning(!!timer);
        } catch (e) {
            console.error('[TimerContext] fetch error:', e);
        }
    };

    useEffect(() => {
        fetchActiveTimer();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const channel = supabase
            .channel(`timer-context:${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'task_work_sessions',
                filter: `user_id=eq.${user.id}`,
            }, fetchActiveTimer)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
                filter: `assigned_to=eq.${user.id}`,
            }, fetchActiveTimer)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tasks',
                filter: `created_by=eq.${user.id}`,
            }, fetchActiveTimer)
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [user]);

    return (
        <TimerContext.Provider value={{ activeTimer, isTimerRunning, refreshTimer: fetchActiveTimer }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimer() {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within TimerProvider');
    }
    return context;
}

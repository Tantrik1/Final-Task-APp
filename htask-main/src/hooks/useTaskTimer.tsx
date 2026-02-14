import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TaskSession {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  session_type: 'start' | 'resume';
  duration_seconds: number | null;
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
  const { toast } = useToast();
  
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

  // Fetch task and sessions data
  const fetchData = useCallback(async () => {
    if (!taskId) return;

    try {
      const [taskResult, sessionsResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('first_started_at, completed_at, total_work_time, is_timer_running, status')
          .eq('id', taskId)
          .single(),
        supabase
          .from('task_sessions')
          .select('*')
          .eq('task_id', taskId)
          .order('started_at', { ascending: false }),
      ]);

      if (taskResult.error) throw taskResult.error;

      const task = taskResult.data;
      const sessions = (sessionsResult.data || []) as TaskSession[];
      
      // Find current open session
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
      console.error('Error fetching timer data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Start timer (transition from todo to in_progress)
  const startTimer = async () => {
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const isFirstStart = !state.firstStartedAt;

      // Update task status and timer state
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          is_timer_running: true,
          ...(isFirstStart && { first_started_at: now }),
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Create new session
      const { error: sessionError } = await supabase
        .from('task_sessions')
        .insert({
          task_id: taskId,
          user_id: user.id,
          started_at: now,
          session_type: 'start',
        });

      if (sessionError) throw sessionError;

      toast({ title: '▶️ Timer started!' });
      fetchData();
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({ title: 'Error', description: 'Failed to start timer', variant: 'destructive' });
    }
  };

  // Pause timer (end current session but stay in_progress)
  // Returns session duration so caller can show dialog
  const pauseTimer = async (): Promise<number> => {
    if (!user || !state.currentSessionStart) return 0;

    try {
      const now = new Date();
      const sessionDuration = Math.floor((now.getTime() - state.currentSessionStart.getTime()) / 1000);

      // Find and close open session
      const openSession = state.sessions.find(s => !s.ended_at);
      if (openSession) {
        const { error: sessionError } = await supabase
          .from('task_sessions')
          .update({
            ended_at: now.toISOString(),
            duration_seconds: sessionDuration,
          })
          .eq('id', openSession.id);

        if (sessionError) throw sessionError;
      }

      // Update task
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          is_timer_running: false,
          total_work_time: state.totalWorkTime + sessionDuration,
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      toast({ title: '⏸️ Timer paused' });
      fetchData();
      return sessionDuration;
    } catch (error) {
      console.error('Error pausing timer:', error);
      toast({ title: 'Error', description: 'Failed to pause timer', variant: 'destructive' });
      return 0;
    }
  };

  // Update task custom status
  const updateCustomStatus = async (customStatusId: string, isCompleted?: boolean) => {
    try {
      const updates: Record<string, unknown> = { custom_status_id: customStatusId };
      
      // If marking as done/completed, also set completed_at
      if (isCompleted) {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;
      
      if (isCompleted) {
        toast({ title: '✅ Task completed!' });
      } else {
        toast({ title: '📝 Status updated' });
      }
      
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  // Resume timer (start new session)
  const resumeTimer = async () => {
    if (!user) return;

    try {
      const now = new Date().toISOString();

      // Update task
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ is_timer_running: true })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Create new session
      const { error: sessionError } = await supabase
        .from('task_sessions')
        .insert({
          task_id: taskId,
          user_id: user.id,
          started_at: now,
          session_type: 'resume',
        });

      if (sessionError) throw sessionError;

      toast({ title: '▶️ Timer resumed!' });
      fetchData();
    } catch (error) {
      console.error('Error resuming timer:', error);
      toast({ title: 'Error', description: 'Failed to resume timer', variant: 'destructive' });
    }
  };

  // Complete task
  const completeTask = async () => {
    if (!user) return;

    try {
      const now = new Date();
      let finalWorkTime = state.totalWorkTime;

      // Close any open session
      const openSession = state.sessions.find(s => !s.ended_at);
      if (openSession && state.currentSessionStart) {
        const sessionDuration = Math.floor((now.getTime() - state.currentSessionStart.getTime()) / 1000);
        finalWorkTime += sessionDuration;

        const { error: sessionError } = await supabase
          .from('task_sessions')
          .update({
            ended_at: now.toISOString(),
            duration_seconds: sessionDuration,
          })
          .eq('id', openSession.id);

        if (sessionError) throw sessionError;
      }

      // Update task - use custom_status_id if available
      const updateData: Record<string, unknown> = {
        is_timer_running: false,
        completed_at: now.toISOString(),
        total_work_time: finalWorkTime,
      };
      
      // Set custom_status_id to completed status if provided
      if (completedStatusId) {
        updateData.custom_status_id = completedStatusId;
      }

      const { error: taskError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (taskError) throw taskError;

      toast({ title: '✅ Task completed!' });
      fetchData();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({ title: 'Error', description: 'Failed to complete task', variant: 'destructive' });
    }
  };

  // Format time helper - shows hours:minutes for smoother display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    }
    return '<1m';
  };

  // Format time with seconds for session details
  const formatTimeWithSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const displayTime = state.totalWorkTime + elapsedTime;

  return {
    ...state,
    elapsedTime,
    displayTime,
    isLoading,
    startTimer,
    pauseTimer,
    resumeTimer,
    completeTask,
    updateCustomStatus,
    formatTime,
    formatTimeWithSeconds,
    refresh: fetchData,
  };
}

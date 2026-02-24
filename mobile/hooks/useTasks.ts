import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface Task {
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    due_date: string | null;
    assigned_to: string | null;
    created_by: string;
    position: number;
    custom_status_id: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export function useTasks(projectId: string | undefined, userId?: string) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchTasks = useCallback(async () => {
        if (!projectId) return;

        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', projectId)
                .order('position', { ascending: true });

            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    // Realtime subscription
    useEffect(() => {
        if (!projectId) return;

        const channel = supabase
            .channel(`project-tasks-${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `project_id=eq.${projectId}`,
                },
                () => {
                    fetchTasks();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [projectId, fetchTasks]);

    const createTask = async (data: Partial<Task>) => {
        if (!projectId) return null;

        try {
            // T-01: Use userId passed in from caller (already available via useAuth context).
            // avoids an async network round-trip on every createTask call.
            if (!userId) throw new Error('Not authenticated');

            const maxPosition = Math.max(...tasks.map(t => t.position), -1);

            const { data: newTask, error } = await supabase
                .from('tasks')
                .insert({
                    ...data,
                    project_id: projectId,
                    created_by: userId,
                    position: maxPosition + 1,
                })
                .select()
                .single();

            if (error) throw error;
            return newTask;
        } catch (error: any) {
            console.error('Error creating task:', error);
            Alert.alert('Error', error.message);
            return null;
        }
    };

    const updateTask = async (id: string, updates: Partial<Task>) => {
        try {
            // T-02: Strip trigger-managed fields — these are kept in sync by trg_sync_task_status.
            // Directly writing them bypasses the trigger and creates enum/custom_status_id drift.
            const { status: _s, completed_at: _c, first_started_at: _f, ...safeUpdates } = updates as any;

            const { error } = await supabase
                .from('tasks')
                .update(safeUpdates)
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error('Error updating task:', error);
            Alert.alert('Error', error.message);
            return false;
        }
    };

    const deleteTask = async (id: string) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error: any) {
            console.error('Error deleting task:', error);
            Alert.alert('Error', error.message);
            return false;
        }
    };

    const reorderTasks = async (reorderedTasks: Task[]) => {
        try {
            setTasks(reorderedTasks);
            const updates = reorderedTasks.map((task, index) =>
                supabase
                    .from('tasks')
                    .update({ position: index })
                    .eq('id', task.id)
            );
            await Promise.all(updates);
            return true;
        } catch (error: any) {
            console.error('Error reordering tasks:', error);
            Alert.alert('Error', error.message);
            fetchTasks();
            return false;
        }
    };

    return {
        tasks,
        isLoading,
        createTask,
        updateTask,
        deleteTask,
        reorderTasks,
        refresh: fetchTasks,
    };
}

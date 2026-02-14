import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProjectStatus {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export function useProjectStatuses(projectId: string | undefined) {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('project_statuses')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`project-statuses-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_statuses',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchStatuses]);

  const createStatus = async (data: { name: string; color: string; is_completed?: boolean }) => {
    if (!projectId) return null;

    try {
      const maxPosition = Math.max(...statuses.map(s => s.position), -1);
      
      const { data: newStatus, error } = await supabase
        .from('project_statuses')
        .insert({
          project_id: projectId,
          name: data.name,
          color: data.color,
          is_completed: data.is_completed || false,
          position: maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: '✅ Status created' });
      return newStatus;
    } catch (error: any) {
      console.error('Error creating status:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const updateStatus = async (id: string, data: Partial<Pick<ProjectStatus, 'name' | 'color' | 'is_completed' | 'is_default'>>) => {
    try {
      const { error } = await supabase
        .from('project_statuses')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      toast({ title: '✅ Status updated' });
      return true;
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const deleteStatus = async (id: string) => {
    try {
      // Check how many tasks use this status
      const { count: taskCount, error: countError } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('custom_status_id', id);

      if (countError) throw countError;

      // If tasks exist, reassign them to the default status
      if (taskCount && taskCount > 0) {
        const defaultStatus = getDefaultStatus();
        
        // Prevent deleting if it's the only status or the default status
        if (!defaultStatus || defaultStatus.id === id) {
          // Find any other status to use as fallback
          const fallbackStatus = statuses.find(s => s.id !== id);
          
          if (!fallbackStatus) {
            toast({ 
              title: 'Cannot delete', 
              description: 'This is the only status. Create another before deleting.', 
              variant: 'destructive' 
            });
            return false;
          }
          
          // Reassign tasks to fallback
          const { error: reassignError } = await supabase
            .from('tasks')
            .update({ custom_status_id: fallbackStatus.id })
            .eq('custom_status_id', id);

          if (reassignError) throw reassignError;
          
          toast({ 
            title: `${taskCount} task(s) moved to "${fallbackStatus.name}"`,
          });
        } else {
          // Reassign tasks to default status
          const { error: reassignError } = await supabase
            .from('tasks')
            .update({ custom_status_id: defaultStatus.id })
            .eq('custom_status_id', id);

          if (reassignError) throw reassignError;
          
          toast({ 
            title: `${taskCount} task(s) moved to "${defaultStatus.name}"`,
          });
        }
      }

      // Now delete the status
      const { error } = await supabase
        .from('project_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: '🗑️ Status deleted' });
      return true;
    } catch (error: any) {
      console.error('Error deleting status:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const reorderStatuses = async (reorderedStatuses: ProjectStatus[]) => {
    try {
      // Optimistically update local state
      setStatuses(reorderedStatuses);

      // Update positions in database
      const updates = reorderedStatuses.map((status, index) => 
        supabase
          .from('project_statuses')
          .update({ position: index })
          .eq('id', status.id)
      );

      await Promise.all(updates);
      return true;
    } catch (error: any) {
      console.error('Error reordering statuses:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      fetchStatuses(); // Revert on error
      return false;
    }
  };

  const getDefaultStatus = () => statuses.find(s => s.is_default) || statuses[0];
  const getCompletedStatus = () => statuses.find(s => s.is_completed);

  return {
    statuses,
    isLoading,
    createStatus,
    updateStatus,
    deleteStatus,
    reorderStatuses,
    getDefaultStatus,
    getCompletedStatus,
    refresh: fetchStatuses,
  };
}

import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TaskCard } from './TaskCard';
import { Button } from '@/components/ui/button';
import { Plus, SortAsc, Filter, Loader2 } from 'lucide-react';
import { TaskSheet } from './TaskSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database } from '@/integrations/supabase/types';
import { useProjectStatuses } from '@/hooks/useProjectStatuses';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TaskListProps {
  projectId: string;
  tasks: Task[];
  onUpdate: () => void;
}

type SortOption = 'created' | 'due_date' | 'priority' | 'title';

export function TaskList({ projectId, tasks, onUpdate }: TaskListProps) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('created');
  const [filterStatusIds, setFilterStatusIds] = useState<string[]>([]);

  // Fetch project statuses for filtering
  const { statuses, isLoading: statusesLoading, getDefaultStatus } = useProjectStatuses(projectId);

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

  // Get default status ID for orphaned tasks
  const defaultStatusId = useMemo(() => {
    const defaultStatus = getDefaultStatus();
    return defaultStatus?.id;
  }, [getDefaultStatus]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStatusIds.length === 0) return true;
      // Handle orphaned tasks - treat them as belonging to default status
      const taskStatusId = t.custom_status_id || defaultStatusId;
      return taskStatusId && filterStatusIds.includes(taskStatusId);
    });
  }, [tasks, filterStatusIds, defaultStatusId]);

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [filteredTasks, sortBy]);

  const handleStatusChange = async (taskId: string, statusId: string) => {
    try {
      await supabase.from('tasks').update({ custom_status_id: statusId }).eq('id', taskId);
      onUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const toggleStatusFilter = (statusId: string) => {
    setFilterStatusIds((prev) =>
      prev.includes(statusId) ? prev.filter((s) => s !== statusId) : [...prev, statusId]
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SortAsc className="h-4 w-4 mr-2" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sortBy === 'created'}
                onCheckedChange={() => setSortBy('created')}
              >
                Created date
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === 'due_date'}
                onCheckedChange={() => setSortBy('due_date')}
              >
                Due date
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === 'priority'}
                onCheckedChange={() => setSortBy('priority')}
              >
                Priority
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortBy === 'title'}
                onCheckedChange={() => setSortBy('title')}
              >
                Title
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter by Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
                {filterStatusIds.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
                    {filterStatusIds.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statusesLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : statuses.length === 0 ? (
                <div className="px-2 py-1 text-sm text-muted-foreground">No statuses</div>
              ) : (
                statuses.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status.id}
                    checked={filterStatusIds.includes(status.id)}
                    onCheckedChange={() => toggleStatusFilter(status.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-2.5 w-2.5 rounded-full" 
                        style={{ backgroundColor: status.color }}
                      />
                      {status.name}
                    </div>
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button onClick={() => setAddTaskOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Task Cards */}
      {sortedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            {tasks.length === 0 ? 'No tasks yet' : 'No tasks match the current filter'}
          </p>
          {tasks.length === 0 && (
            <Button onClick={() => setAddTaskOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={(taskId, statusId) => handleStatusChange(taskId, statusId)}
              onUpdate={onUpdate}
              allStatuses={statuses}
            />
          ))}
        </div>
      )}

      <TaskSheet
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        projectId={projectId}
        onSuccess={onUpdate}
      />
    </div>
  );
}

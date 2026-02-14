import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Calendar, 
  User, 
  Filter,
  LayoutGrid,
  List,
  Clock,
  Target,
  Sparkles,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskSheet } from '@/components/tasks/TaskSheet';
import { SwipeableTaskTile } from '@/components/tasks/SwipeableTaskTile';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Database } from '@/integrations/supabase/types';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type TaskStatus = Database['public']['Enums']['task_status'];

interface TaskWithProject extends Task {
  project?: Pick<Project, 'id' | 'name' | 'color'>;
}

const filterOptions = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'assigned', label: 'Assigned', icon: User },
  { id: 'in_progress', label: 'In Progress', icon: TrendingUp },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle },
] as const;

type FilterType = typeof filterOptions[number]['id'];

export default function WorkspaceMyTasks() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(isMobile ? 'list' : 'grid');

  const fetchTasks = useCallback(async () => {
    if (!workspaceId || !user) return;

    try {
      // First get all project IDs in this workspace
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, color')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false);

      if (!projects || projects.length === 0) {
        setTasks([]);
        setIsLoading(false);
        return;
      }

      const projectIds = projects.map(p => p.id);
      const projectMap = new Map(projects.map(p => [p.id, p]));

      // Fetch tasks
      let query = supabase
        .from('tasks')
        .select('*')
        .in('project_id', projectIds)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false });

      // Apply filters
      if (activeFilter === 'assigned') {
        query = query.eq('assigned_to', user.id);
      } else if (activeFilter === 'in_progress') {
        query = query.eq('status', 'in_progress');
      } else {
        // 'all' and 'overdue' - show both assigned to me or created by me
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let tasksWithProjects = (data || []).map(task => ({
        ...task,
        project: projectMap.get(task.project_id),
      }));

      // Filter overdue tasks client-side
      if (activeFilter === 'overdue') {
        tasksWithProjects = tasksWithProjects.filter(t => 
          t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
        );
      }

      setTasks(tasksWithProjects);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, user, activeFilter]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel('my-tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchTasks]);

  const handleStartTask = async (taskId: string) => {
    try {
      const now = new Date().toISOString();
      
      // Get current task
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Update task status and create session
      const updates: any = { 
        status: 'in_progress' as TaskStatus, 
        is_timer_running: true 
      };
      
      if (!task.first_started_at) {
        updates.first_started_at = now;
      }

      await supabase.from('tasks').update(updates).eq('id', taskId);
      
      // Create new session
      await supabase.from('task_sessions').insert({
        task_id: taskId,
        user_id: user!.id,
        started_at: now,
        session_type: task.first_started_at ? 'resume' : 'start',
      });

      toast({ title: '▶️ Task started!' });
      fetchTasks();
    } catch (error) {
      console.error('Error starting task:', error);
      toast({ title: 'Error', description: 'Failed to start task', variant: 'destructive' });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const now = new Date().toISOString();

      // Close any open sessions
      const { data: openSessions } = await supabase
        .from('task_sessions')
        .select('*')
        .eq('task_id', taskId)
        .is('ended_at', null);

      if (openSessions && openSessions.length > 0) {
        for (const session of openSessions) {
          const duration = Math.floor((new Date().getTime() - new Date(session.started_at).getTime()) / 1000);
          await supabase
            .from('task_sessions')
            .update({ ended_at: now, duration_seconds: duration })
            .eq('id', session.id);
        }
      }

      // Update task
      await supabase
        .from('tasks')
        .update({ 
          status: 'done' as TaskStatus, 
          completed_at: now,
          is_timer_running: false,
        })
        .eq('id', taskId);

      toast({ title: '🎉 Task completed!' });
      fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({ title: 'Error', description: 'Failed to complete task', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      if (status === 'done') {
        await handleCompleteTask(taskId);
      } else {
        await supabase.from('tasks').update({ status }).eq('id', taskId);
        fetchTasks();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Group tasks
  const todayTasks = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const tomorrowTasks = tasks.filter(t => t.due_date && isTomorrow(new Date(t.due_date)));
  const thisWeekTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const date = new Date(t.due_date);
    if (isToday(date) || isTomorrow(date)) return false;
    return isWithinInterval(date, { start: startOfWeek(new Date()), end: endOfWeek(new Date()) });
  });
  const overdueTasks = tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const laterTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const date = new Date(t.due_date);
    if (isPast(date) || isToday(date) || isTomorrow(date)) return false;
    if (isWithinInterval(date, { start: startOfWeek(new Date()), end: endOfWeek(new Date()) })) return false;
    return true;
  });
  const noDueDateTasks = tasks.filter(t => !t.due_date);
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

  const stats = {
    total: tasks.length,
    overdue: overdueTasks.length,
    today: todayTasks.length,
    inProgress: inProgressTasks.length,
  };

  const renderTaskGroup = (title: string, groupTasks: TaskWithProject[], icon?: React.ReactNode, colorClass?: string) => {
    if (groupTasks.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className={cn('flex items-center gap-2 text-sm font-semibold', colorClass)}>
          {icon}
          <span>{title}</span>
          <Badge variant="secondary" className="rounded-full text-xs px-2">{groupTasks.length}</Badge>
        </div>
        <div className={cn(
          viewMode === 'grid' && !isMobile
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
            : 'space-y-3'
        )}>
          {groupTasks.map(task => (
            isMobile ? (
              <SwipeableTaskTile
                key={task.id}
                task={task}
                project={task.project}
                onStart={handleStartTask}
                onComplete={handleCompleteTask}
              />
            ) : (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onUpdate={fetchTasks}
              />
            )
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl brand-gradient flex items-center justify-center shadow-lg">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">My Tasks</h1>
            <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
              {stats.total} tasks · {stats.inProgress} in progress
            </p>
          </div>
        </div>
        
        <Button 
          onClick={() => setTaskSheetOpen(true)} 
          size={isMobile ? "icon" : "default"}
          className="rounded-xl shadow-md"
        >
          <Plus className="h-4 w-4" />
          {!isMobile && <span className="ml-2">New Task</span>}
        </Button>
      </div>

      {/* Stats Cards - Horizontal swipeable */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          <Card className="surface-blue border-0 shadow-sm min-w-[120px] flex-1">
            <CardContent className="p-4 text-center">
              <p className="text-2xl lg:text-3xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="surface-orange border-0 shadow-sm min-w-[120px] flex-1">
            <CardContent className="p-4 text-center">
              <p className="text-2xl lg:text-3xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className="surface-warning border-0 shadow-sm min-w-[120px] flex-1">
            <CardContent className="p-4 text-center">
              <p className="text-2xl lg:text-3xl font-bold">{stats.today}</p>
              <p className="text-xs text-muted-foreground">Due Today</p>
            </CardContent>
          </Card>
          <Card className={cn(
            "border-0 shadow-sm min-w-[120px] flex-1",
            stats.overdue > 0 ? "surface-destructive" : "surface-success"
          )}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl lg:text-3xl font-bold">{stats.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-thin">
          {filterOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setActiveFilter(option.id)}
              className={cn(
                'pill-button flex items-center gap-2 text-sm whitespace-nowrap shrink-0',
                activeFilter === option.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <option.icon className="h-4 w-4" />
              {option.label}
            </button>
          ))}
        </div>

        {!isMobile && (
          <div className="flex items-center rounded-xl border bg-muted/30 p-1 ml-4">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-lg transition-all',
                viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg transition-all',
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Swipe hint for mobile */}
      {isMobile && tasks.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          ← Swipe right to start · Swipe left to complete →
        </p>
      )}

      {/* Tasks */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl brand-gradient-soft flex items-center justify-center mb-4">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm text-sm">
              {activeFilter === 'assigned' 
                ? "You don't have any tasks assigned to you." 
                : activeFilter === 'in_progress'
                  ? "No tasks in progress."
                  : activeFilter === 'overdue'
                    ? "Great! No overdue tasks."
                    : "Create your first task to get started!"
              }
            </p>
            <Button onClick={() => setTaskSheetOpen(true)} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {renderTaskGroup('Overdue', overdueTasks, <Clock className="h-4 w-4" />, 'text-destructive')}
          {renderTaskGroup('Today', todayTasks, <Calendar className="h-4 w-4" />, 'text-warning')}
          {renderTaskGroup('Tomorrow', tomorrowTasks, <Calendar className="h-4 w-4" />, 'text-info')}
          {renderTaskGroup('This Week', thisWeekTasks, <Calendar className="h-4 w-4" />)}
          {renderTaskGroup('Later', laterTasks, <Calendar className="h-4 w-4" />, 'text-muted-foreground')}
          {renderTaskGroup('No Due Date', noDueDateTasks, <Sparkles className="h-4 w-4" />, 'text-muted-foreground')}
        </div>
      )}

      <TaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        onSuccess={fetchTasks}
      />
    </div>
  );
}

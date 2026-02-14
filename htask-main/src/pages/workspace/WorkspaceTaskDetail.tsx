import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTaskTimer } from '@/hooks/useTaskTimer';
import { useProjectStatuses, ProjectStatus } from '@/hooks/useProjectStatuses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Calendar as CalendarIcon,
  User,
  MessageCircle,
  Paperclip,
  Link2,
  Timer,
  Activity,
  Sparkles,
  History,
  Target,
  TrendingUp,
  Circle,
  Loader2,
  Eye,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import { TaskComments } from '@/components/tasks/TaskComments';
import { TaskAttachments } from '@/components/tasks/TaskAttachments';
import { TaskLinks } from '@/components/tasks/TaskLinks';
import { TaskActivity } from '@/components/tasks/TaskActivity';
import { TimerStatusDialog } from '@/components/tasks/TimerStatusDialog';
import {
  InlineEditableText,
  InlineEditableTextarea,
  InlineEditableSelect,
  InlineEditableDatePicker,
  InlineEditableAssignee,
  SelectOption,
} from '@/components/tasks/inline-edit';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface TaskWithProject extends Task {
  project?: Project;
  assignee?: { full_name: string | null; email: string };
  creator?: { full_name: string | null; email: string };
  custom_status?: ProjectStatus;
}

export default function WorkspaceTaskDetail() {
  const { workspaceId, projectId, taskId } = useParams<{
    workspaceId: string;
    projectId: string;
    taskId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState<TaskWithProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pausedSessionTime, setPausedSessionTime] = useState('');

  // Fetch project statuses first to get completed status ID
  const { statuses, isLoading: statusesLoading, getDefaultStatus, getCompletedStatus } = useProjectStatuses(projectId);

  // Get completed status ID for the timer
  const completedStatusId = useMemo(() => {
    const completedStatus = getCompletedStatus();
    return completedStatus?.id;
  }, [getCompletedStatus]);

  const timer = useTaskTimer(taskId || '', completedStatusId);

  // Handle pause with status dialog
  const handlePauseTimer = async () => {
    const sessionDuration = await timer.pauseTimer();
    if (sessionDuration > 0) {
      setPausedSessionTime(timer.formatTime(sessionDuration));
      setStatusDialogOpen(true);
    }
  };

  // Handle status change from dialog (for timer completion)
  const handleStatusChangeFromDialog = (status: TaskStatus) => {
    // When timer completes, set to completed status if available
    if (status === 'done' && completedStatusId) {
      handleCustomStatusSave(completedStatusId);
    }
  };

  const fetchTask = async () => {
    if (!taskId) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          project:projects(*),
          assignee:profiles!tasks_assigned_to_fkey(full_name, email),
          creator:profiles!tasks_created_by_fkey(full_name, email)
        `)
        .eq('id', taskId)
        .single();

      if (error) throw error;
      setTask(data as TaskWithProject);
    } catch (error) {
      console.error('Error fetching task:', error);
      toast({ title: 'Error', description: 'Task not found', variant: 'destructive' });
      navigate(`/workspace/${workspaceId}/projects/${projectId}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  // Real-time subscription for task updates
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`,
        },
        async (payload) => {
          // Fetch fresh data to get related profiles
          await fetchTask();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  // Individual field update functions
  const updateField = async (field: string, value: unknown) => {
    if (!task) throw new Error('No task');

    const { error } = await supabase
      .from('tasks')
      .update({ [field]: value })
      .eq('id', task.id);

    if (error) throw error;

    // Optimistically update local state
    setTask(prev => prev ? { ...prev, [field]: value } : null);
    timer.refresh();
  };

  const handleTitleSave = async (value: string) => {
    if (!value.trim()) throw new Error('Title required');
    await updateField('title', value.trim());
  };

  const handleDescriptionSave = async (value: string) => {
    await updateField('description', value || null);
  };

  const handleCustomStatusSave = async (value: string) => {
    await updateField('custom_status_id', value);
  };

  const handlePrioritySave = async (value: string) => {
    await updateField('priority', value);
  };

  const handleDueDateSave = async (value: Date | undefined) => {
    await updateField('due_date', value ? format(value, 'yyyy-MM-dd') : null);
  };

  const handleAssigneeSave = async (value: string | null) => {
    await updateField('assigned_to', value);
    // Re-fetch to get updated assignee profile
    await fetchTask();
  };

  const priorityConfig: Record<TaskPriority, { label: string; color: string; dot: string }> = {
    low: { label: 'Low', color: 'bg-muted/50 text-muted-foreground', dot: 'bg-muted-foreground' },
    medium: { label: 'Medium', color: 'bg-warning/10 text-warning', dot: 'bg-warning' },
    high: { label: 'High', color: 'bg-primary/10 text-primary', dot: 'bg-primary' },
    urgent: { label: 'Urgent', color: 'bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  };

  // Build status options from project statuses
  const statusOptions: SelectOption[] = useMemo(() => {
    return statuses.map((status) => ({
      value: status.id,
      label: status.name,
      color: getStatusColorClass(status.color),
      icon: status.is_completed ? CheckCircle2 : status.is_default ? Circle : status.position === 1 ? Loader2 : Eye,
    }));
  }, [statuses]);

  // Get current status from custom_status_id
  const currentStatus = useMemo(() => {
    if (!task?.custom_status_id) {
      return getDefaultStatus();
    }
    return statuses.find(s => s.id === task.custom_status_id) || getDefaultStatus();
  }, [task?.custom_status_id, statuses, getDefaultStatus]);

  const priorityOptions: SelectOption[] = Object.entries(priorityConfig).map(([key, { label, color }]) => ({
    value: key,
    label,
    color,
  }));

  // Helper to get a color class from hex color
  function getStatusColorClass(hexColor: string): string {
    const colorMap: Record<string, string> = {
      '#94a3b8': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      '#f97316': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      '#8b5cf6': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      '#22c55e': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      '#6366f1': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      '#3b82f6': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      '#ef4444': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      '#eab308': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      '#14b8a6': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
      '#ec4899': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    };
    return colorMap[hexColor.toLowerCase()] || 'bg-muted text-foreground';
  }

  // Get icon for status
  function getStatusIcon(status: ProjectStatus | undefined) {
    if (!status) return Circle;
    if (status.is_completed) return CheckCircle2;
    if (status.is_default) return Circle;
    return status.position === 1 ? TrendingUp : status.position === 2 ? Eye : Activity;
  }

  const StatusIcon = getStatusIcon(currentStatus);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!task) return null;

  const isCompleted = currentStatus?.is_completed || false;
  const taskDuration = timer.firstStartedAt && timer.completedAt
    ? differenceInDays(timer.completedAt, timer.firstStartedAt) + 1
    : timer.firstStartedAt
      ? differenceInDays(new Date(), timer.firstStartedAt) + 1
      : 0;

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-24 lg:pb-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/workspace/${workspaceId}/projects/${projectId}`)}
          className="shrink-0 mt-0.5 rounded-xl h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Inline Editable Title */}
          <InlineEditableText
            value={task.title}
            onSave={handleTitleSave}
            placeholder="Task title"
            validate={(v) => v.trim().length > 0}
            className={cn(
              'text-xl lg:text-2xl font-bold leading-tight',
              isCompleted && 'line-through text-muted-foreground'
            )}
            inputClassName="text-xl lg:text-2xl font-bold h-11"
          />

          {/* Badges Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <InlineEditableSelect
              value={task.custom_status_id || currentStatus?.id || ''}
              options={statusOptions}
              onSave={handleCustomStatusSave}
              renderTrigger={(option, isLoadingSelect) => (
                <Badge
                  className={cn(
                    'gap-1.5 cursor-pointer hover:scale-105 transition-transform px-3 py-1',
                    currentStatus ? getStatusColorClass(currentStatus.color) : 'bg-muted'
                  )}
                >
                  {isLoadingSelect ? (
                    <span className="animate-spin h-3 w-3">⏳</span>
                  ) : (
                    <>
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: currentStatus?.color || '#94a3b8' }}
                      />
                      {currentStatus?.name || 'Unknown'}
                    </>
                  )}
                </Badge>
              )}
            />

            <InlineEditableSelect
              value={task.priority}
              options={priorityOptions}
              onSave={handlePrioritySave}
              renderTrigger={() => (
                <Badge className={cn(
                  'cursor-pointer hover:scale-105 transition-transform px-3 py-1',
                  priorityConfig[task.priority].color
                )}>
                  <span className={cn('h-2 w-2 rounded-full mr-1.5', priorityConfig[task.priority].dot)} />
                  {priorityConfig[task.priority].label}
                </Badge>
              )}
            />

            {task.project && (
              <Badge
                variant="outline"
                className="px-3 py-1"
                style={{ borderColor: task.project.color || 'hsl(var(--border))' }}
              >
                <Sparkles
                  className="h-3 w-3 mr-1.5"
                  style={{ color: task.project.color || 'hsl(var(--primary))' }}
                />
                {task.project.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Timer Card - Clean Modern Design */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="bg-gradient-to-br from-card via-card to-muted/20 rounded-3xl p-5 border border-border/50 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Timer display */}
            <div className="flex items-center gap-4">
              {/* Timer icon with state indicator */}
              <div className={cn(
                'h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300',
                timer.isRunning
                  ? 'bg-success/15 ring-2 ring-success/20'
                  : task.status === 'done'
                    ? 'bg-success/10'
                    : 'bg-muted/50'
              )}>
                {timer.isRunning ? (
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-success/30" />
                    <Timer className="h-6 w-6 text-success relative z-10" />
                  </div>
                ) : isCompleted ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : (
                  <Timer className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              {/* Time display - Hours and minutes only */}
              <div>
                <p className="text-3xl font-bold font-mono tracking-tight">
                  {timer.formatTime(timer.displayTime)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timer.isRunning ? (
                    <span className="text-success font-medium">● Timer running</span>
                  ) : timer.sessions.length > 0 ? (
                    `${timer.sessions.length} work session${timer.sessions.length > 1 ? 's' : ''}`
                  ) : (
                    'No time tracked'
                  )}
                </p>
              </div>
            </div>

            {/* Right side - Timer Controls */}
            <div className="flex items-center gap-2">
              {isCompleted ? (
                <Badge className="bg-success/10 text-success border-0 px-4 py-2">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completed
                </Badge>
              ) : timer.isRunning ? (
                /* When running: show Pause + Complete buttons */
                <>
                  <Button
                    onClick={handlePauseTimer}
                    variant="outline"
                    size="lg"
                    className="rounded-2xl gap-2 h-12"
                  >
                    <Pause className="h-5 w-5" />
                    <span className="hidden sm:inline">Pause</span>
                  </Button>
                  <Button
                    onClick={timer.completeTask}
                    size="lg"
                    className="rounded-2xl gap-2 h-12 bg-success hover:bg-success/90 shadow-lg"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="hidden sm:inline">Complete</span>
                  </Button>
                </>
              ) : timer.firstStartedAt ? (
                /* Paused state: show Resume + Complete buttons */
                <>
                  <Button
                    onClick={timer.resumeTimer}
                    size="lg"
                    className="rounded-2xl gap-2 h-12 brand-gradient shadow-lg"
                  >
                    <Play className="h-5 w-5" />
                    <span className="hidden sm:inline">Resume</span>
                  </Button>
                  <Button
                    onClick={timer.completeTask}
                    variant="outline"
                    size="lg"
                    className="rounded-2xl gap-2 h-12"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="hidden sm:inline">Complete</span>
                  </Button>
                </>
              ) : (
                /* Not started: show Start button */
                <Button
                  onClick={timer.startTimer}
                  size="lg"
                  className="rounded-2xl gap-2 h-12 brand-gradient shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Play className="h-5 w-5" />
                  <span className="hidden sm:inline">Start Timer</span>
                </Button>
              )}
            </div>
          </div>

          {/* Mini stats row */}
          {(timer.firstStartedAt || timer.sessions.length > 0) && (
            <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Started</span>
                <span className="font-medium">
                  {timer.firstStartedAt ? format(timer.firstStartedAt, 'MMM d') : '-'}
                </span>
              </div>
              {timer.completedAt && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">{format(timer.completedAt, 'MMM d')}</span>
                </div>
              )}
              {taskDuration > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  <span className="text-muted-foreground">Elapsed</span>
                  <span className="font-medium">{taskDuration} day{taskDuration > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Tabs - Clean Design */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList className="w-full justify-start bg-muted/30 p-1.5 h-auto gap-1 rounded-2xl border border-border/30 overflow-x-auto">
          <TabsTrigger
            value="details"
            className="gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Details</span>
          </TabsTrigger>
          <TabsTrigger
            value="sessions"
            className="gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
            {timer.sessions.length > 0 && (
              <span className="ml-1 h-5 min-w-5 px-1 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">
                {timer.sessions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Comments</span>
          </TabsTrigger>
          <TabsTrigger
            value="attachments"
            className="gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Paperclip className="h-4 w-4" />
            <span className="hidden sm:inline">Files</span>
          </TabsTrigger>
          <TabsTrigger
            value="links"
            className="gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Links</span>
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left Column - Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <InlineEditableTextarea
                  value={task.description || ''}
                  onSave={handleDescriptionSave}
                  placeholder="Click to add a description..."
                  minRows={4}
                />
              </CardContent>
            </Card>

            {/* Right Column - Meta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Assignee */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assignee
                  </span>
                  <InlineEditableAssignee
                    value={task.assigned_to}
                    assignee={task.assignee ? { id: task.assigned_to!, ...task.assignee } : null}
                    onSave={handleAssigneeSave}
                  />
                </div>

                {/* Due Date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Due Date
                  </span>
                  <InlineEditableDatePicker
                    value={task.due_date ? new Date(task.due_date) : undefined}
                    onSave={handleDueDateSave}
                    placeholder="Set due date"
                  />
                </div>

                {/* Priority */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Priority</span>
                  <InlineEditableSelect
                    value={task.priority}
                    options={priorityOptions}
                    onSave={handlePrioritySave}
                    renderTrigger={() => (
                      <Badge className={cn('cursor-pointer hover:scale-105 transition-transform', priorityConfig[task.priority].color)}>
                        {priorityConfig[task.priority].label}
                      </Badge>
                    )}
                  />
                </div>

                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <InlineEditableSelect
                    value={task.custom_status_id || currentStatus?.id || ''}
                    options={statusOptions}
                    onSave={handleCustomStatusSave}
                    renderTrigger={() => (
                      <Badge
                        className={cn(
                          'cursor-pointer hover:scale-105 transition-transform',
                          currentStatus ? getStatusColorClass(currentStatus.color) : 'bg-muted'
                        )}
                      >
                        <div
                          className="h-2 w-2 rounded-full mr-1.5"
                          style={{ backgroundColor: currentStatus?.color || '#94a3b8' }}
                        />
                        {currentStatus?.name || 'Unknown'}
                      </Badge>
                    )}
                  />
                </div>

                {/* Creator */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Created by</span>
                  {task.creator && (
                    <span className="text-sm">
                      {task.creator.full_name || task.creator.email.split('@')[0]}
                    </span>
                  )}
                </div>

                {/* Created date */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm">
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5" />
                Work Sessions ({timer.sessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timer.sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No sessions yet</p>
                  <p className="text-sm">Start the timer to track your work</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timer.sessions.map((session, index) => (
                    <div
                      key={session.id}
                      className={cn(
                        'flex items-center gap-4 p-3 rounded-xl border',
                        !session.ended_at && 'bg-success/5 border-success/30'
                      )}
                    >
                      <div
                        className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium',
                          session.session_type === 'start'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-warning/10 text-warning'
                        )}
                      >
                        {timer.sessions.length - index}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {session.session_type === 'start' ? 'Started' : 'Resumed'}
                          </span>
                          {!session.ended_at && (
                            <Badge variant="outline" className="text-success border-success">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(session.started_at), 'MMM d, yyyy h:mm a')}
                          {session.ended_at && (
                            <> → {format(new Date(session.ended_at), 'h:mm a')}</>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium">
                          {session.duration_seconds
                            ? timer.formatTimeWithSeconds(session.duration_seconds)
                            : timer.isRunning
                              ? timer.formatTimeWithSeconds(timer.elapsedTime)
                              : '-'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments">
          <Card>
            <CardContent className="p-4">
              <TaskComments taskId={taskId!} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments">
          <Card>
            <CardContent className="p-4">
              <TaskAttachments taskId={taskId!} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links">
          <Card>
            <CardContent className="p-4">
              <TaskLinks taskId={taskId!} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-4">
              <TaskActivity taskId={taskId!} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Timer Status Dialog - shown when timer is paused */}
      {task && (
        <TimerStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          currentStatus={task.status}
          onStatusChange={handleStatusChangeFromDialog}
          workTime={pausedSessionTime}
        />
      )}
    </div>
  );
}

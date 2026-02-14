import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon,
  Circle,
  CheckCircle2,
  Sparkles,
  Clock
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isPast
} from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskSheet } from '@/components/tasks/TaskSheet';
import { Database } from '@/integrations/supabase/types';
import { motion, AnimatePresence } from 'framer-motion';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

interface TaskWithProject extends Task {
  project?: Pick<Project, 'id' | 'name' | 'color'>;
}

export default function WorkspaceCalendar() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [taskSheetOpen, setTaskSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  const fetchTasks = async () => {
    if (!workspaceId) return;

    try {
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

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .in('project_id', projectIds)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const tasksWithProjects = (data || []).map(task => ({
        ...task,
        project: projectMap.get(task.project_id),
      }));

      setTasks(tasksWithProjects);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [workspaceId]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithProject[]>();
    tasks.forEach(task => {
      if (task.due_date) {
        const dateKey = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return tasksByDate.get(dateKey) || [];
  }, [selectedDate, tasksByDate]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (isMobile) {
      setDaySheetOpen(true);
    }
  };

  const handleTaskClick = (task: TaskWithProject) => {
    navigate(`/workspace/${workspaceId}/projects/${task.project_id}/tasks/${task.id}`);
  };

  const priorityConfig = {
    low: { color: 'bg-muted-foreground', ring: 'ring-muted-foreground/30' },
    medium: { color: 'bg-warning', ring: 'ring-warning/30' },
    high: { color: 'bg-primary', ring: 'ring-primary/30' },
    urgent: { color: 'bg-destructive', ring: 'ring-destructive/30' },
  };

  const statusConfig = {
    todo: { color: 'bg-muted', text: 'text-muted-foreground', border: 'border-l-muted-foreground' },
    in_progress: { color: 'bg-primary/10', text: 'text-primary', border: 'border-l-primary' },
    review: { color: 'bg-info/10', text: 'text-info', border: 'border-l-info' },
    done: { color: 'bg-success/10', text: 'text-success', border: 'border-l-success' },
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const TaskItem = ({ task, compact = false }: { task: TaskWithProject; compact?: boolean }) => {
    const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
    
    return (
      <motion.button
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={(e) => { e.stopPropagation(); handleTaskClick(task); }}
        className={cn(
          'w-full text-left rounded-xl border transition-all',
          compact ? 'p-2' : 'p-3',
          'bg-card hover:shadow-md border-l-4',
          statusConfig[task.status].border,
          task.status === 'done' && 'opacity-60'
        )}
      >
        <div className="flex items-start gap-2">
          <div className={cn(
            'h-2 w-2 rounded-full mt-1.5 shrink-0',
            priorityConfig[task.priority].color
          )} />
          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium text-sm truncate',
              task.status === 'done' && 'line-through text-muted-foreground'
            )}>
              {task.title}
            </p>
            {!compact && task.project && (
              <Badge
                variant="secondary"
                className="text-[10px] mt-1.5 rounded-full px-2"
                style={{ 
                  backgroundColor: task.project.color ? `${task.project.color}15` : undefined,
                  color: task.project.color 
                }}
              >
                {task.project.name}
              </Badge>
            )}
          </div>
          {task.status === 'done' ? (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          ) : isOverdue ? (
            <Clock className="h-4 w-4 text-destructive shrink-0" />
          ) : null}
        </div>
      </motion.button>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 h-full flex flex-col lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 flex items-center justify-center shadow-sm">
            <CalendarIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">Calendar</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">View tasks by date</p>
          </div>
        </div>
        <Button 
          onClick={() => { setSelectedTask(null); setTaskSheetOpen(true); }} 
          size="sm"
          className="rounded-xl gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Task</span>
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-muted/30 rounded-2xl p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="text-center">
          <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM')}</h2>
          <p className="text-xs text-muted-foreground">{format(currentMonth, 'yyyy')}</p>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Today Button */}
      {!isToday(startOfMonth(currentMonth)) && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(new Date())}
          className="w-full rounded-xl border-dashed"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Jump to Today
        </Button>
      )}

      {isLoading ? (
        <div className="grid grid-cols-7 gap-1 flex-1">
          {[...Array(35)].map((_, i) => (
            <Skeleton key={i} className="min-h-[60px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Calendar Grid */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Week day headers */}
            <div className="grid grid-cols-7 mb-1">
              {weekDays.map((day, idx) => (
                <div
                  key={day}
                  className={cn(
                    'text-center text-xs font-semibold py-2 rounded-lg',
                    idx === 0 || idx === 6 ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
                  {isMobile ? day[0] : day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
              {calendarDays.map((day, index) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);
                const hasOverdue = dayTasks.some(t => t.status !== 'done' && isPast(new Date(t.due_date!)));
                const completedCount = dayTasks.filter(t => t.status === 'done').length;
                const pendingCount = dayTasks.length - completedCount;

                return (
                  <motion.button
                    key={index}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'min-h-[56px] lg:min-h-[90px] p-1 lg:p-2 rounded-xl border transition-all text-left flex flex-col relative overflow-hidden',
                      isCurrentMonth 
                        ? 'bg-card hover:bg-muted/50 border-border/50' 
                        : 'bg-muted/20 text-muted-foreground/50 border-transparent',
                      isSelected && 'ring-2 ring-primary border-primary/50 bg-primary/5',
                      isTodayDate && !isSelected && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          'text-xs lg:text-sm font-semibold h-6 w-6 lg:h-7 lg:w-7 flex items-center justify-center rounded-lg transition-colors',
                          isTodayDate && 'bg-primary text-primary-foreground',
                          !isTodayDate && isSelected && 'bg-primary/10 text-primary'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      
                      {/* Task count indicator */}
                      {dayTasks.length > 0 && (
                        <div className="flex gap-0.5">
                          {pendingCount > 0 && (
                            <span className={cn(
                              'h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                              hasOverdue ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                            )}>
                              {pendingCount}
                            </span>
                          )}
                          {completedCount > 0 && (
                            <span className="h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-success/10 text-success">
                              ✓{completedCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Task preview - Desktop only */}
                    <div className="hidden lg:flex flex-1 mt-1 flex-col gap-0.5 overflow-hidden">
                      {dayTasks.slice(0, 2).map(task => (
                        <div
                          key={task.id}
                          className={cn(
                            'text-[10px] truncate px-1.5 py-0.5 rounded-md border-l-2 bg-card/80',
                            statusConfig[task.status].border,
                            task.status === 'done' && 'opacity-50 line-through'
                          )}
                        >
                          {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{dayTasks.length - 2} more
                        </span>
                      )}
                    </div>

                    {/* Mobile task dots */}
                    {isMobile && dayTasks.length > 0 && (
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {dayTasks.slice(0, 4).map(task => (
                          <div
                            key={task.id}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              priorityConfig[task.priority].color,
                              task.status === 'done' && 'opacity-40'
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Desktop Side Panel */}
          {!isMobile && (
            <div className="w-80 shrink-0">
              <div className="h-full rounded-2xl border bg-card/50 backdrop-blur-sm p-4 flex flex-col">
                {selectedDate ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-lg">{format(selectedDate, 'EEEE')}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(selectedDate, 'MMMM d, yyyy')}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => { setSelectedTask(null); setTaskSheetOpen(true); }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <ScrollArea className="flex-1 -mx-4 px-4">
                      {selectedDateTasks.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                          <p className="font-medium">No tasks</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Add a task for this day</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                            {selectedDateTasks.map(task => (
                              <TaskItem key={task.id} task={task} />
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 flex items-center justify-center mb-4">
                      <CalendarIcon className="h-7 w-7 text-primary/50" />
                    </div>
                    <p className="font-medium">Select a date</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Click on a day to view tasks</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Day Sheet */}
      <Sheet open={daySheetOpen} onOpenChange={setDaySheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader className="pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-left">
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Tasks'}
                </SheetTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedDateTasks.length} task{selectedDateTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => { setDaySheetOpen(false); setSelectedTask(null); setTaskSheetOpen(true); }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100%-80px)] mt-4">
            {selectedDateTasks.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium">No tasks for this day</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Tap + to add a new task</p>
              </div>
            ) : (
              <div className="space-y-2 pb-8">
                {selectedDateTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <TaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        task={selectedTask}
        onSuccess={fetchTasks}
      />
    </div>
  );
}

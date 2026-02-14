import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, 
  isSameMonth, isSameDay, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek, isPast 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import { motion, AnimatePresence } from 'framer-motion';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TaskWithProject extends Task {
  project?: { id: string; name: string; color: string | null };
}

interface ProjectCalendarViewProps {
  tasks: Task[];
  projectId: string;
  projectColor?: string | null;
  workspaceId?: string;
  onAddTask?: () => void;
}

const priorityConfig: Record<string, { color: string }> = {
  low: { color: 'bg-muted-foreground' },
  medium: { color: 'bg-warning' },
  high: { color: 'bg-primary' },
  urgent: { color: 'bg-destructive' },
};

const statusBorder: Record<string, string> = {
  todo: 'border-l-muted-foreground',
  in_progress: 'border-l-primary',
  review: 'border-l-info',
  done: 'border-l-success',
};

export function ProjectCalendarView({ tasks, projectId, projectColor, workspaceId, onAddTask }: ProjectCalendarViewProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(task => {
      if (task.due_date) {
        const key = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    });
    return map;
  }, [tasks]);

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    return tasksByDate.get(format(selectedDate, 'yyyy-MM-dd')) || [];
  }, [selectedDate, tasksByDate]);

  // Count tasks with due dates this month
  const monthTaskCount = useMemo(() => {
    let count = 0;
    calendarDays.forEach(day => {
      if (isSameMonth(day, currentMonth)) {
        const key = format(day, 'yyyy-MM-dd');
        count += (tasksByDate.get(key) || []).length;
      }
    });
    return count;
  }, [calendarDays, currentMonth, tasksByDate]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDaySheetOpen(true);
  };

  const handleTaskClick = (task: Task) => {
    if (workspaceId) {
      navigate(`/workspace/${workspaceId}/projects/${task.project_id}/tasks/${task.id}`);
    }
  };

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const weekDaysFull = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h3 className="text-base font-bold">{format(currentMonth, 'MMMM yyyy')}</h3>
          <p className="text-xs text-muted-foreground">{monthTaskCount} tasks this month</p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Today Button */}
      {!isToday(startOfMonth(currentMonth)) && (
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="w-full rounded-xl border-dashed text-xs h-8">
          <Sparkles className="h-3 w-3 mr-1.5" /> Jump to Today
        </Button>
      )}

      {/* Week Day Headers */}
      <div className="grid grid-cols-7">
        {weekDays.map((day, idx) => (
          <div key={idx} className={cn('text-center text-[11px] font-semibold py-1.5', idx === 0 || idx === 6 ? 'text-muted-foreground' : 'text-foreground')}>
            <span className="sm:hidden">{day}</span>
            <span className="hidden sm:inline">{weekDaysFull[idx]}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasOverdue = dayTasks.some(t => t.status !== 'done' && t.due_date && isPast(new Date(t.due_date)));
          const completedCount = dayTasks.filter(t => t.status === 'done').length;
          const pendingCount = dayTasks.length - completedCount;

          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              className={cn(
                'min-h-[52px] sm:min-h-[80px] lg:min-h-[90px] p-1 sm:p-1.5 rounded-lg sm:rounded-xl border transition-all text-left flex flex-col relative',
                isCurrentMonth ? 'bg-card hover:bg-muted/50 border-border/40' : 'bg-muted/10 text-muted-foreground/40 border-transparent',
                isSelected && 'ring-2 ring-primary border-primary/50 bg-primary/5',
                isTodayDate && !isSelected && 'border-primary/50 bg-primary/5'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className={cn(
                  'text-[11px] sm:text-xs font-semibold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-md',
                  isTodayDate && 'bg-primary text-primary-foreground',
                  !isTodayDate && isSelected && 'bg-primary/10 text-primary'
                )}>
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <div className="flex gap-0.5">
                    {pendingCount > 0 && (
                      <span className={cn(
                        'h-4 min-w-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center',
                        hasOverdue ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                      )}>
                        {pendingCount}
                      </span>
                    )}
                    {completedCount > 0 && (
                      <span className="h-4 min-w-[14px] px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center bg-success/10 text-success">
                        ✓
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Task preview - larger screens only */}
              <div className="hidden sm:flex flex-1 mt-0.5 flex-col gap-0.5 overflow-hidden w-full">
                {dayTasks.slice(0, 2).map(task => (
                  <div key={task.id} className={cn(
                    'text-[9px] lg:text-[10px] truncate px-1 py-0.5 rounded border-l-2 bg-card/80 w-full',
                    statusBorder[task.status] || 'border-l-muted-foreground',
                    task.status === 'done' && 'opacity-50 line-through'
                  )}>
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 2 && (
                  <span className="text-[9px] text-muted-foreground px-1">+{dayTasks.length - 2}</span>
                )}
              </div>

              {/* Mobile task dots */}
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center sm:hidden">
                  {dayTasks.slice(0, 3).map(task => (
                    <div key={task.id} className={cn(
                      'h-1 w-1 rounded-full',
                      priorityConfig[task.priority]?.color || 'bg-muted-foreground',
                      task.status === 'done' && 'opacity-40'
                    )} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tasks without due dates summary */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 text-xs text-muted-foreground">
          <span>{tasks.filter(t => !t.due_date).length} tasks without due dates</span>
        </div>
      )}

      {/* Day Detail Sheet */}
      <Sheet open={daySheetOpen} onOpenChange={setDaySheetOpen}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl px-4 pb-safe">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-left">
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Tasks'}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100%-60px)]">
            {selectedDateTasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">No tasks on this day</p>
                <p className="text-xs mt-1">Tasks with due dates will appear here</p>
                {onAddTask && (
                  <Button size="sm" className="mt-4 rounded-xl gap-1.5" onClick={() => { setDaySheetOpen(false); onAddTask(); }}>
                    <Plus className="h-3.5 w-3.5" /> Add Task
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateTasks.map(task => {
                  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
                  return (
                    <motion.button
                      key={task.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTaskClick(task)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 bg-card hover:shadow-md transition-all border-l-4',
                        statusBorder[task.status] || 'border-l-muted-foreground',
                        task.status === 'done' && 'opacity-60'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', priorityConfig[task.priority]?.color || 'bg-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('font-medium text-sm truncate', task.status === 'done' && 'line-through text-muted-foreground')}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] rounded-full px-2 h-5 capitalize">
                              {task.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] rounded-full px-2 h-5 capitalize">
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        {task.status === 'done' ? (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        ) : isOverdue ? (
                          <Clock className="h-4 w-4 text-destructive shrink-0" />
                        ) : null}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

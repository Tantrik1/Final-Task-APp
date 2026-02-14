import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, GripVertical, Timer, ChevronRight } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskSheet } from './TaskSheet';
import { motion } from 'framer-motion';
import { ProjectStatus } from '@/hooks/useProjectStatuses';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, statusId: string) => void;
  onUpdate?: () => void;
  isDragging?: boolean;
  showDragHandle?: boolean;
  columnColor?: string;
  allStatuses?: ProjectStatus[];
}

export function TaskCard({ 
  task, 
  onStatusChange, 
  onUpdate, 
  isDragging, 
  showDragHandle, 
  columnColor,
  allStatuses = [],
}: TaskCardProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const handleOpenDetail = () => {
    navigate(`/workspace/${workspaceId}/projects/${task.project_id}/tasks/${task.id}`);
  };

  const priorityConfig = {
    low: { color: 'bg-muted-foreground', label: 'Low' },
    medium: { color: 'bg-warning', label: 'Medium' },
    high: { color: 'bg-primary', label: 'High' },
    urgent: { color: 'bg-destructive', label: 'Urgent' },
  };

  // Get current status from allStatuses
  const currentStatus = useMemo(() => {
    if (!task.custom_status_id || allStatuses.length === 0) return null;
    return allStatuses.find(s => s.id === task.custom_status_id);
  }, [task.custom_status_id, allStatuses]);

  // Check if task is in a completed status
  const isCompleted = currentStatus?.is_completed ?? task.status === 'done';

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
  const isDueToday = task.due_date && isToday(new Date(task.due_date));
  const isDueTomorrow = task.due_date && isTomorrow(new Date(task.due_date));
  const isTimerRunning = (task as any).is_timer_running;

  const handleCheckboxChange = () => {
    if (onStatusChange && allStatuses.length > 0) {
      // Find the completed status or default status
      const completedStatus = allStatuses.find(s => s.is_completed);
      const defaultStatus = allStatuses.find(s => s.is_default) || allStatuses[0];
      
      if (isCompleted) {
        // Move to default status
        if (defaultStatus) {
          onStatusChange(task.id, defaultStatus.id);
        }
      } else {
        // Move to completed status
        if (completedStatus) {
          onStatusChange(task.id, completedStatus.id);
        }
      }
    }
  };

  const formatWorkTime = (seconds: number | null) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return '<1m';
  };

  const formatDueDate = () => {
    if (!task.due_date) return null;
    if (isDueToday) return 'Today';
    if (isDueTomorrow) return 'Tomorrow';
    return format(new Date(task.due_date), 'MMM d');
  };

  const workTimeDisplay = formatWorkTime((task as any).total_work_time);

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.01, y: -2 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'relative p-4 rounded-2xl cursor-pointer group transition-all duration-200',
          'bg-card border border-border/40 hover:border-border',
          'shadow-sm hover:shadow-lg',
          isDragging && 'shadow-2xl ring-2 ring-primary/40 rotate-2 scale-105 z-50',
          isCompleted && 'opacity-70',
          isTimerRunning && 'ring-2 ring-success/30'
        )}
        onClick={handleOpenDetail}
      >
        {/* Priority indicator bar */}
        <div className={cn(
          'absolute left-0 top-3 bottom-3 w-1 rounded-full',
          priorityConfig[task.priority].color
        )} />

        <div className="flex items-start gap-3 pl-2">
          {/* Drag Handle */}
          {showDragHandle && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing -ml-1">
              <GripVertical className="h-5 w-5 text-muted-foreground/50" />
            </div>
          )}

          {/* Checkbox */}
          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleCheckboxChange}
              className={cn(
                'h-5 w-5 rounded-lg border-2 transition-all',
                isCompleted 
                  ? 'bg-success border-success' 
                  : 'border-muted-foreground/30 hover:border-primary'
              )}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <p
              className={cn(
                'font-medium text-sm leading-snug pr-2',
                isCompleted && 'line-through text-muted-foreground'
              )}
            >
              {task.title}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Timer running indicator */}
              {isTimerRunning && (
                <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border-0 gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                  Active
                </Badge>
              )}

              {/* Work time */}
              {workTimeDisplay && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full gap-1 border-muted-foreground/20">
                  <Timer className="h-3 w-3" />
                  {workTimeDisplay}
                </Badge>
              )}

              {/* Due date */}
              {task.due_date && (
                <Badge 
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full gap-1',
                    isOverdue && 'bg-destructive/10 border-destructive/30 text-destructive',
                    isDueToday && !isOverdue && 'bg-warning/10 border-warning/30 text-warning',
                    !isOverdue && !isDueToday && 'border-muted-foreground/20'
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDueDate()}
                </Badge>
              )}

              {/* Status badge (only in list view, show dynamic status) */}
              {!showDragHandle && currentStatus && (
                <Badge 
                  className="text-[10px] px-2 py-0.5 rounded-full border-0"
                  style={{ 
                    backgroundColor: `${currentStatus.color}20`,
                    color: currentStatus.color,
                  }}
                >
                  {currentStatus.name}
                </Badge>
              )}
            </div>
          </div>

          {/* Right side - Assignee + Arrow */}
          <div className="flex items-center gap-2 shrink-0">
            {task.assigned_to && (
              <Avatar className="h-7 w-7 ring-2 ring-background">
                <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                  A
                </AvatarFallback>
              </Avatar>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </motion.div>

      <TaskSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        onSuccess={onUpdate}
      />
    </>
  );
}

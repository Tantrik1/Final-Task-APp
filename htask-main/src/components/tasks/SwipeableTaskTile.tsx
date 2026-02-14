import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Play, Pause, CheckCircle2, Timer, Calendar } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = { id: string; name: string; color: string | null };

interface SwipeableTaskTileProps {
  task: Task;
  project?: Project;
  onStart?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
}

const SWIPE_THRESHOLD = 80;

export function SwipeableTaskTile({ 
  task, 
  project, 
  onStart, 
  onPause, 
  onComplete 
}: SwipeableTaskTileProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rightOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const leftScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const rightScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);

  const isTimerRunning = (task as any).is_timer_running;
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
  const isDueToday = task.due_date && isToday(new Date(task.due_date));

  const priorityColors = {
    low: 'bg-muted-foreground',
    medium: 'bg-warning',
    high: 'bg-primary',
    urgent: 'bg-destructive',
  };

  const statusConfig = {
    todo: { label: 'To Do', bg: 'bg-muted/50', text: 'text-muted-foreground' },
    in_progress: { label: 'In Progress', bg: 'bg-primary/10', text: 'text-primary' },
    review: { label: 'Review', bg: 'bg-info/10', text: 'text-info' },
    done: { label: 'Done', bg: 'bg-success/10', text: 'text-success' },
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    
    if (info.offset.x > SWIPE_THRESHOLD) {
      // Swiped right - Start/Resume
      if (task.status === 'todo' || (task.status === 'in_progress' && !isTimerRunning)) {
        onStart?.(task.id);
      }
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      // Swiped left - Complete
      onComplete?.(task.id);
    }
  };

  const handleTap = () => {
    if (!isDragging) {
      navigate(`/workspace/${workspaceId}/projects/${task.project_id}/tasks/${task.id}`);
    }
  };

  const formatWorkTime = (seconds: number | null) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const workTimeDisplay = formatWorkTime((task as any).total_work_time);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">
      {/* Swipe Action Backgrounds */}
      <motion.div 
        className="absolute inset-y-0 left-0 w-24 swipe-action-start flex items-center justify-start pl-5"
        style={{ opacity: leftOpacity }}
      >
        <motion.div style={{ scale: leftScale }} className="text-white">
          <Play className="h-6 w-6" />
        </motion.div>
      </motion.div>

      <motion.div 
        className="absolute inset-y-0 right-0 w-24 swipe-action-done flex items-center justify-end pr-5"
        style={{ opacity: rightOpacity }}
      >
        <motion.div style={{ scale: rightScale }} className="text-white">
          <CheckCircle2 className="h-6 w-6" />
        </motion.div>
      </motion.div>

      {/* Main Tile */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={handleTap}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'task-tile relative p-4 cursor-pointer',
          isTimerRunning && 'task-tile-active pulse-glow',
          task.status === 'done' && 'opacity-60'
        )}
      >
        {/* Project color strip */}
        {project?.color && (
          <div 
            className="absolute left-0 inset-y-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: project.color }}
          />
        )}

        <div className="pl-3 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                'font-semibold text-base leading-tight line-clamp-2',
                task.status === 'done' && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h3>
              {project && (
                <p 
                  className="text-xs mt-1 font-medium"
                  style={{ color: project.color || 'inherit' }}
                >
                  {project.name}
                </p>
              )}
            </div>

            {/* Avatar */}
            {task.assigned_to && (
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  A
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority dot */}
            <div className={cn('status-dot', priorityColors[task.priority])} />

            {/* Status badge */}
            <Badge 
              variant="secondary" 
              className={cn('text-xs rounded-full', statusConfig[task.status].bg, statusConfig[task.status].text)}
            >
              {statusConfig[task.status].label}
            </Badge>

            {/* Timer indicator */}
            {isTimerRunning && (
              <Badge variant="secondary" className="text-xs rounded-full bg-success/10 text-success gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                Running
              </Badge>
            )}

            {/* Work time */}
            {workTimeDisplay && (
              <Badge variant="outline" className="text-xs rounded-full gap-1">
                <Timer className="h-3 w-3" />
                {workTimeDisplay}
              </Badge>
            )}

            {/* Due date */}
            {task.due_date && (
              <Badge 
                variant="outline"
                className={cn(
                  'text-xs rounded-full gap-1',
                  isOverdue && 'border-destructive/50 text-destructive',
                  isDueToday && !isOverdue && 'border-warning/50 text-warning'
                )}
              >
                <Calendar className="h-3 w-3" />
                {isDueToday ? 'Today' : format(new Date(task.due_date), 'MMM d')}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

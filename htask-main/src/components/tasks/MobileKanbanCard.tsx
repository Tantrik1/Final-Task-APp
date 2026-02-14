import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Calendar, ChevronDown, Timer } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ProjectStatus } from '@/hooks/useProjectStatuses';

type Task = Database['public']['Tables']['tasks']['Row'];

interface MobileKanbanCardProps {
  task: Task;
  isDragging?: boolean;
  onStatusChange: (taskId: string, statusId: string) => void;
  onUpdate: () => void;
  allStatuses?: ProjectStatus[];
}

const priorityConfig = {
  low: { color: 'bg-muted-foreground', barColor: 'bg-muted-foreground' },
  medium: { color: 'bg-warning', barColor: 'bg-warning' },
  high: { color: 'bg-primary', barColor: 'bg-primary' },
  urgent: { color: 'bg-destructive', barColor: 'bg-destructive' },
};

export function MobileKanbanCard({ 
  task, 
  isDragging, 
  onStatusChange, 
  onUpdate,
  allStatuses = [],
}: MobileKanbanCardProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  // Get current status from allStatuses
  const currentStatus = useMemo(() => {
    if (!task.custom_status_id || allStatuses.length === 0) return null;
    return allStatuses.find(s => s.id === task.custom_status_id);
  }, [task.custom_status_id, allStatuses]);

  const isCompleted = currentStatus?.is_completed ?? task.status === 'done';
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isCompleted;
  const isDueToday = task.due_date && isToday(new Date(task.due_date));
  const isDueTomorrow = task.due_date && isTomorrow(new Date(task.due_date));
  const isTimerRunning = (task as any).is_timer_running;

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

  const handleCardClick = () => {
    navigate(`/workspace/${workspaceId}/projects/${task.project_id}/tasks/${task.id}`);
  };

  return (
    <motion.div
      layout
      className={cn(
        'relative bg-background rounded-xl border border-border/50 overflow-hidden',
        'shadow-sm transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/30',
        isTimerRunning && 'ring-1 ring-success/50'
      )}
    >
      {/* Priority bar */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1',
        priorityConfig[task.priority].barColor
      )} />

      <div className="p-3 pl-4">
        {/* Title row */}
        <div 
          className="flex items-start justify-between gap-2 cursor-pointer"
          onClick={handleCardClick}
        >
          <div className="flex-1 min-w-0">
            <p className={cn(
              'font-medium text-sm leading-snug line-clamp-2',
              isCompleted && 'line-through text-muted-foreground'
            )}>
              {task.title}
            </p>
          </div>
          {task.assigned_to && (
            <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
              <AvatarFallback className="text-[9px] bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                A
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-2.5 gap-2">
          {/* Left: Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-1.5 text-xs font-medium hover:bg-muted/50 px-2 py-1 rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: currentStatus?.color || '#94a3b8' }}
                />
                <span className="text-muted-foreground">
                  {currentStatus?.name || 'Unknown'}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              {allStatuses.map((status) => (
                <DropdownMenuItem
                  key={status.id}
                  onClick={() => onStatusChange(task.id, status.id)}
                  className="gap-2"
                >
                  <div 
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span>{status.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Right: Timer & Due date */}
          <div className="flex items-center gap-1.5">
            {isTimerRunning && (
              <Badge className="text-[10px] px-1.5 py-0 h-5 rounded-full bg-success/10 text-success border-0 gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                </span>
                Live
              </Badge>
            )}
            
            {workTimeDisplay && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Timer className="h-3 w-3" />
                {workTimeDisplay}
              </div>
            )}

            {task.due_date && (
              <div className={cn(
                'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md',
                isOverdue && 'bg-destructive/10 text-destructive',
                isDueToday && !isOverdue && 'bg-warning/10 text-warning',
                !isOverdue && !isDueToday && 'text-muted-foreground'
              )}>
                <Calendar className="h-3 w-3" />
                {formatDueDate()}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

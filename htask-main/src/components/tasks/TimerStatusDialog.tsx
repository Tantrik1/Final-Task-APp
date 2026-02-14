import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  TrendingUp, 
  Activity, 
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];

interface TimerStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
  workTime: string;
}

const statusOptions: Array<{ 
  value: TaskStatus; 
  label: string; 
  icon: typeof Target; 
  color: string;
  description: string;
}> = [
  { 
    value: 'todo', 
    label: 'To Do', 
    icon: Target, 
    color: 'bg-muted/50 text-muted-foreground border-muted',
    description: 'Move back to backlog'
  },
  { 
    value: 'in_progress', 
    label: 'In Progress', 
    icon: TrendingUp, 
    color: 'bg-primary/10 text-primary border-primary/30',
    description: 'Keep working on it'
  },
  { 
    value: 'review', 
    label: 'Review', 
    icon: Activity, 
    color: 'bg-info/10 text-info border-info/30',
    description: 'Ready for review'
  },
  { 
    value: 'done', 
    label: 'Done', 
    icon: CheckCircle2, 
    color: 'bg-success/10 text-success border-success/30',
    description: 'Mark as completed'
  },
];

export function TimerStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  onStatusChange,
  workTime,
}: TimerStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(currentStatus);

  const handleConfirm = () => {
    onStatusChange(selectedStatus);
    onOpenChange(false);
  };

  const handleKeepStatus = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Timer Paused
          </DialogTitle>
          <DialogDescription>
            You worked for <span className="font-semibold text-foreground">{workTime}</span>. 
            Would you like to update the task status?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          {statusOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedStatus === option.value;
            const isCurrent = currentStatus === option.value;

            return (
              <button
                key={option.value}
                onClick={() => setSelectedStatus(option.value)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                )}
              >
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center',
                  option.color
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleKeepStatus}>
            Keep Current
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

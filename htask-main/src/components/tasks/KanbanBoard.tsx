import { useState, useEffect, useMemo } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TaskCard } from './TaskCard';
import { Button } from '@/components/ui/button';
import { Plus, Circle, Loader2, CheckCircle2, Eye, Sparkles } from 'lucide-react';
import { TaskSheet } from './TaskSheet';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileKanbanColumn } from './MobileKanbanColumn';
import { useProjectStatuses, ProjectStatus } from '@/hooks/useProjectStatuses';

type Task = Database['public']['Tables']['tasks']['Row'];

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onUpdate: () => void;
}

// Color utilities for dynamic columns
function getColorClasses(color: string) {
  // Convert hex to tailwind-like classes or use direct style
  const colorMap: Record<string, { gradient: string; iconColor: string; dotColor: string; bgColor: string }> = {
    '#94a3b8': { 
      gradient: 'from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/30',
      iconColor: 'text-slate-500',
      dotColor: 'bg-slate-400',
      bgColor: 'bg-slate-100/80 dark:bg-slate-800/50'
    },
    '#f97316': {
      gradient: 'from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-950/20',
      iconColor: 'text-orange-500',
      dotColor: 'bg-orange-500',
      bgColor: 'bg-orange-100/80 dark:bg-orange-900/30'
    },
    '#8b5cf6': {
      gradient: 'from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-950/20',
      iconColor: 'text-violet-500',
      dotColor: 'bg-violet-500',
      bgColor: 'bg-violet-100/80 dark:bg-violet-900/30'
    },
    '#22c55e': {
      gradient: 'from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/20',
      iconColor: 'text-emerald-500',
      dotColor: 'bg-emerald-500',
      bgColor: 'bg-emerald-100/80 dark:bg-emerald-900/30'
    },
    '#6366f1': {
      gradient: 'from-primary/15 to-primary/5',
      iconColor: 'text-primary',
      dotColor: 'bg-primary',
      bgColor: 'bg-primary/10'
    },
    '#3b82f6': {
      gradient: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-950/20',
      iconColor: 'text-blue-500',
      dotColor: 'bg-blue-500',
      bgColor: 'bg-blue-100/80 dark:bg-blue-900/30'
    },
    '#ef4444': {
      gradient: 'from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-950/20',
      iconColor: 'text-red-500',
      dotColor: 'bg-red-500',
      bgColor: 'bg-red-100/80 dark:bg-red-900/30'
    },
    '#eab308': {
      gradient: 'from-yellow-100 to-yellow-50 dark:from-yellow-900/30 dark:to-yellow-950/20',
      iconColor: 'text-yellow-500',
      dotColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-100/80 dark:bg-yellow-900/30'
    },
    '#14b8a6': {
      gradient: 'from-teal-100 to-teal-50 dark:from-teal-900/30 dark:to-teal-950/20',
      iconColor: 'text-teal-500',
      dotColor: 'bg-teal-500',
      bgColor: 'bg-teal-100/80 dark:bg-teal-900/30'
    },
    '#ec4899': {
      gradient: 'from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-950/20',
      iconColor: 'text-pink-500',
      dotColor: 'bg-pink-500',
      bgColor: 'bg-pink-100/80 dark:bg-pink-900/30'
    },
  };

  // Try to match color or use default with inline style
  const lowerColor = color.toLowerCase();
  if (colorMap[lowerColor]) {
    return colorMap[lowerColor];
  }

  // Default classes for unknown colors
  return {
    gradient: 'from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-900/30',
    iconColor: 'text-gray-500',
    dotColor: '', // Will use inline style
    bgColor: 'bg-gray-100/80 dark:bg-gray-800/50',
    customColor: color,
  };
}

function getStatusIcon(status: ProjectStatus) {
  if (status.is_completed) return CheckCircle2;
  if (status.is_default) return Circle;
  return status.position === 1 ? Loader2 : status.position === 2 ? Eye : Circle;
}

export function KanbanBoard({ projectId, tasks, onUpdate }: KanbanBoardProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
  const [addTaskStatusId, setAddTaskStatusId] = useState<string | null>(null);
  
  // Fetch dynamic statuses from project
  const { statuses, isLoading: statusesLoading } = useProjectStatuses(projectId);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Build columns from project statuses
  const columns = useMemo(() => {
    return statuses.map(status => {
      const colorClasses = getColorClasses(status.color);
      return {
        id: status.id,
        title: status.name,
        color: status.color,
        isCompleted: status.is_completed,
        isDefault: status.is_default,
        position: status.position,
        ...colorClasses,
        icon: getStatusIcon(status),
      };
    });
  }, [statuses]);

  // Get the default status ID for handling orphaned tasks
  const defaultStatusId = useMemo(() => {
    const defaultStatus = statuses.find(s => s.is_default) || statuses[0];
    return defaultStatus?.id;
  }, [statuses]);

  const getTasksByStatusId = (statusId: string) => {
    // If this is the default column, also include orphaned tasks (null custom_status_id)
    const isDefaultColumn = statusId === defaultStatusId;
    return localTasks
      .filter((t) => {
        if (t.custom_status_id === statusId) return true;
        // Show orphaned tasks in the default column
        if (isDefaultColumn && !t.custom_status_id) return true;
        return false;
      })
      .sort((a, b) => a.position - b.position);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStatusId = destination.droppableId;
    const taskId = draggableId;

    // Optimistic update
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, custom_status_id: newStatusId } : t))
    );

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ custom_status_id: newStatusId, position: destination.index })
        .eq('id', taskId);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      setLocalTasks(tasks);
      toast({
        title: 'Error',
        description: 'Failed to move task',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (taskId: string, statusId: string) => {
    setLocalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, custom_status_id: statusId } : t))
    );

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ custom_status_id: statusId })
        .eq('id', taskId);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
      setLocalTasks(tasks);
    }
  };

  // Loading state
  if (statusesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No statuses (shouldn't happen, but fallback)
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>No statuses configured for this project.</p>
        <p className="text-sm">Go to project settings to add statuses.</p>
      </div>
    );
  }

  // Get default status for new tasks
  const defaultStatus = statuses.find(s => s.is_default) || statuses[0];

  // Mobile Layout: Vertical stacked columns
  if (isMobile) {
    return (
      <>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-3">
            {columns.map((column) => {
              const columnTasks = getTasksByStatusId(column.id);
              return (
                <MobileKanbanColumn
                  key={column.id}
                  column={{
                    id: column.id,
                    title: column.title,
                    dotColor: column.dotColor || '',
                    bgColor: column.bgColor,
                    customColor: (column as any).customColor,
                  }}
                  tasks={columnTasks}
                  onAddTask={() => setAddTaskStatusId(column.id)}
                  onStatusChange={handleStatusChange}
                  onUpdate={onUpdate}
                  allStatuses={statuses}
                />
              );
            })}
          </div>
        </DragDropContext>

        <TaskSheet
          open={addTaskStatusId !== null}
          onOpenChange={(open) => !open && setAddTaskStatusId(null)}
          projectId={projectId}
          defaultStatusId={addTaskStatusId || defaultStatus?.id}
          onSuccess={onUpdate}
        />
      </>
    );
  }

  // Desktop Layout: Horizontal columns with scroll
  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4 min-w-max pr-4">
            {columns.map((column) => {
              const columnTasks = getTasksByStatusId(column.id);
              const Icon = column.icon;
              
              return (
                <motion.div
                  key={column.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-shrink-0 w-[300px] sm:w-[320px] flex flex-col"
                >
                  {/* Column Header */}
                  <div className={cn(
                    'flex items-center justify-between mb-3 px-4 py-3 rounded-2xl bg-gradient-to-br border border-border/50',
                    column.gradient
                  )}>
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'h-8 w-8 rounded-xl flex items-center justify-center bg-background/80 shadow-sm',
                      )}>
                        <Icon className={cn('h-4 w-4', column.iconColor)} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{column.title}</h3>
                        <p className="text-xs text-muted-foreground">{columnTasks.length} tasks</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 rounded-xl hover:bg-background/80 transition-all hover:scale-105',
                        column.iconColor
                      )}
                      onClick={() => setAddTaskStatusId(column.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'flex-1 min-h-[350px] rounded-2xl p-2 space-y-2 transition-all duration-300',
                          snapshot.isDraggingOver 
                            ? 'bg-gradient-to-b from-primary/10 to-primary/5 ring-2 ring-primary/20 ring-dashed scale-[1.01]' 
                            : 'bg-muted/30'
                        )}
                      >
                        <AnimatePresence mode="popLayout">
                          {columnTasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="touch-manipulation"
                                >
                                  <TaskCard
                                    task={task}
                                    isDragging={snapshot.isDragging}
                                    showDragHandle
                                    onStatusChange={(taskId, statusId) => handleStatusChange(taskId, statusId)}
                                    onUpdate={onUpdate}
                                    columnColor={column.dotColor || column.color}
                                    allStatuses={statuses}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </AnimatePresence>
                        {provided.placeholder}

                        {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-40 text-muted-foreground"
                          >
                            <div className={cn(
                              'h-12 w-12 rounded-2xl flex items-center justify-center mb-3 bg-gradient-to-br',
                              column.gradient
                            )}>
                              <Sparkles className={cn('h-5 w-5', column.iconColor)} />
                            </div>
                            <p className="text-sm font-medium">No tasks yet</p>
                            <p className="text-xs text-muted-foreground/60">Drop here or click + to add</p>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </motion.div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-2" />
        </ScrollArea>
      </DragDropContext>

      <TaskSheet
        open={addTaskStatusId !== null}
        onOpenChange={(open) => !open && setAddTaskStatusId(null)}
        projectId={projectId}
        defaultStatusId={addTaskStatusId || defaultStatus?.id}
        onSuccess={onUpdate}
      />
    </>
  );
}

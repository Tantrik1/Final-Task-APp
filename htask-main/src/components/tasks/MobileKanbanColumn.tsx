import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MobileKanbanCard } from './MobileKanbanCard';
import { ProjectStatus } from '@/hooks/useProjectStatuses';

type Task = Database['public']['Tables']['tasks']['Row'];

interface ColumnConfig {
  id: string;
  title: string;
  dotColor: string;
  bgColor: string;
  customColor?: string;
}

interface MobileKanbanColumnProps {
  column: ColumnConfig;
  tasks: Task[];
  onAddTask: () => void;
  onStatusChange: (taskId: string, statusId: string) => void;
  onUpdate: () => void;
  allStatuses?: ProjectStatus[];
}

export function MobileKanbanColumn({ 
  column, 
  tasks, 
  onAddTask, 
  onStatusChange,
  onUpdate,
  allStatuses,
}: MobileKanbanColumnProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border/50">
      {/* Column Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-3 transition-colors',
          column.bgColor
        )}
      >
        <div className="flex items-center gap-2.5">
          <div 
            className={cn('h-3 w-3 rounded-full', column.dotColor)}
            style={column.customColor ? { backgroundColor: column.customColor } : undefined}
          />
          <span className="font-semibold text-sm">{column.title}</span>
          <span className="text-xs text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={(e) => {
              e.stopPropagation();
              onAddTask();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      {/* Droppable Area */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Droppable droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'p-2 space-y-2 min-h-[60px] transition-colors',
                    snapshot.isDraggingOver && 'bg-primary/5'
                  )}
                >
                  {tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="touch-manipulation"
                        >
                          <MobileKanbanCard
                            task={task}
                            isDragging={snapshot.isDragging}
                            onStatusChange={onStatusChange}
                            onUpdate={onUpdate}
                            allStatuses={allStatuses}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  {tasks.length === 0 && !snapshot.isDraggingOver && (
                    <button
                      onClick={onAddTask}
                      className="w-full py-3 text-center text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create new task
                    </button>
                  )}
                </div>
              )}
            </Droppable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

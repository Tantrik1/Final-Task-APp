import { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  LayoutGrid, 
  List, 
  Calendar as CalendarIcon,
  ChevronDown,
  Timer,
  Plus,
  MessageSquare,
  Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';

const views = [
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
];

const kanbanTasks = {
  todo: [
    { title: 'Research competitor analysis', priority: 'medium', assignee: 'SP', dueDate: 'Dec 15' },
    { title: 'Prepare Q4 report', priority: 'high', assignee: 'RK', dueDate: 'Dec 18' },
  ],
  inProgress: [
    { title: 'Design mobile app screens', priority: 'high', assignee: 'AJ', dueDate: 'Dec 12', timer: '4h 30m', isActive: true },
    { title: 'Backend API development', priority: 'urgent', assignee: 'BT', dueDate: 'Dec 14' },
  ],
  done: [
    { title: 'Setup project repository', priority: 'low', assignee: 'KP', dueDate: 'Completed', completed: true },
  ],
};

const listTasks = [
  { title: 'Design mobile app screens', status: 'In Progress', priority: 'high', assignee: 'AJ', dueDate: 'Dec 12', timer: '4h 30m', comments: 5, attachments: 2 },
  { title: 'Backend API development', status: 'In Progress', priority: 'urgent', assignee: 'BT', dueDate: 'Dec 14', comments: 8, attachments: 1 },
  { title: 'Research competitor analysis', status: 'To Do', priority: 'medium', assignee: 'SP', dueDate: 'Dec 15', comments: 2, attachments: 0 },
  { title: 'Prepare Q4 report', status: 'To Do', priority: 'high', assignee: 'RK', dueDate: 'Dec 18', comments: 0, attachments: 3 },
  { title: 'Setup project repository', status: 'Done', priority: 'low', assignee: 'KP', dueDate: 'Completed', comments: 1, attachments: 0, completed: true },
];

const priorityColors = {
  low: 'bg-muted-foreground',
  medium: 'bg-warning',
  high: 'bg-primary',
  urgent: 'bg-destructive',
};

const statusColors = {
  'To Do': { bg: 'bg-muted', text: 'text-muted-foreground' },
  'In Progress': { bg: 'bg-primary/10', text: 'text-primary' },
  'Done': { bg: 'bg-success/10', text: 'text-success' },
};

export function LandingShowcase() {
  const [activeView, setActiveView] = useState('kanban');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="showcase" ref={ref} className="py-20 md:py-32 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Product
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            See It in Action
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Experience the power of Hamro Task with multiple views designed 
            for how your team works best.
          </p>
        </motion.div>

        {/* View Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList className="h-12 p-1.5 rounded-full bg-card border border-border">
              {views.map((view) => (
                <TabsTrigger
                  key={view.id}
                  value={view.id}
                  className="px-6 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                >
                  <view.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{view.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Showcase Container */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="relative"
        >
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 rounded-3xl blur-2xl" />
          
          <div className="relative bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden">
            {/* Browser Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive/80" />
                <div className="h-3 w-3 rounded-full bg-warning/80" />
                <div className="h-3 w-3 rounded-full bg-success/80" />
              </div>
              <div className="flex-1 max-w-md mx-4">
                <div className="h-8 rounded-full bg-background border border-border flex items-center px-4">
                  <span className="text-xs text-muted-foreground truncate">app.hamrotask.com/projects/marketing-campaign</span>
                </div>
              </div>
              <div className="w-16" />
            </div>

            {/* Content Area */}
            <div className="p-4 md:p-6 min-h-[400px]">
              {activeView === 'kanban' && <KanbanPreview />}
              {activeView === 'list' && <ListPreview />}
              {activeView === 'calendar' && <CalendarPreview />}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function KanbanPreview() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
      {/* To Do Column */}
      <div className="flex-shrink-0 w-[260px] md:w-[280px]">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            <span className="text-sm font-semibold">To Do</span>
            <span className="text-xs text-muted-foreground">2</span>
          </div>
          <button className="p-1 hover:bg-muted rounded-lg">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2 bg-muted/30 rounded-xl p-2 min-h-[300px]">
          {kanbanTasks.todo.map((task, i) => (
            <KanbanCard key={i} task={task} />
          ))}
        </div>
      </div>

      {/* In Progress Column */}
      <div className="flex-shrink-0 w-[260px] md:w-[280px]">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-sm font-semibold">In Progress</span>
            <span className="text-xs text-muted-foreground">2</span>
          </div>
          <button className="p-1 hover:bg-muted rounded-lg">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2 bg-primary/5 rounded-xl p-2 min-h-[300px]">
          {kanbanTasks.inProgress.map((task, i) => (
            <KanbanCard key={i} task={task} highlighted={task.isActive} />
          ))}
        </div>
      </div>

      {/* Done Column */}
      <div className="flex-shrink-0 w-[260px] md:w-[280px]">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold">Done</span>
            <span className="text-xs text-muted-foreground">1</span>
          </div>
          <button className="p-1 hover:bg-muted rounded-lg">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2 bg-emerald-500/5 rounded-xl p-2 min-h-[300px]">
          {kanbanTasks.done.map((task, i) => (
            <KanbanCard key={i} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ task, highlighted = false }: { task: any; highlighted?: boolean }) {
  const priority = priorityColors[task.priority as keyof typeof priorityColors];
  
  return (
    <div className={cn(
      'relative p-3 rounded-xl bg-background border border-border/50 transition-all hover:shadow-md cursor-pointer',
      highlighted && 'ring-2 ring-success/30',
      task.completed && 'opacity-60'
    )}>
      <div className={cn('absolute left-0 top-2 bottom-2 w-1 rounded-full', priority)} />
      <div className="pl-2">
        <p className={cn(
          'text-sm font-medium mb-2',
          task.completed && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {task.timer && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 rounded-full bg-success/10 text-success border-0 gap-0.5">
                <Timer className="h-2.5 w-2.5" />
                {task.timer}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{task.dueDate}</span>
          </div>
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
              {task.assignee}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

function ListPreview() {
  return (
    <div className="space-y-2">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Due Date</div>
        <div className="col-span-2">Assignee</div>
        <div className="col-span-1"></div>
      </div>

      {/* Task Rows */}
      {listTasks.map((task, i) => {
        const status = statusColors[task.status as keyof typeof statusColors];
        const priority = priorityColors[task.priority as keyof typeof priorityColors];
        
        return (
          <div
            key={i}
            className={cn(
              'relative grid md:grid-cols-12 gap-2 md:gap-4 p-3 md:p-4 rounded-xl bg-background border border-border/50 hover:shadow-md transition-all cursor-pointer items-center',
              task.completed && 'opacity-60'
            )}
          >
            <div className={cn('absolute left-0 top-2 bottom-2 w-1 rounded-full', priority)} />
            
            {/* Task Title */}
            <div className="md:col-span-5 flex items-center gap-3 pl-2">
              <Checkbox checked={task.completed} className="h-4 w-4" />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  task.completed && 'line-through text-muted-foreground'
                )}>
                  {task.title}
                </p>
                <div className="flex items-center gap-2 md:hidden mt-1">
                  <Badge className={cn('text-[10px] px-2 py-0 h-5', status.bg, status.text)}>
                    {task.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{task.dueDate}</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="hidden md:block col-span-2">
              <Badge className={cn('text-xs', status.bg, status.text)}>
                {task.status}
              </Badge>
            </div>

            {/* Due Date */}
            <div className="hidden md:block col-span-2 text-sm text-muted-foreground">
              {task.dueDate}
            </div>

            {/* Assignee */}
            <div className="hidden md:block col-span-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {task.assignee}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Meta */}
            <div className="hidden md:flex col-span-1 items-center gap-2 text-muted-foreground">
              {task.comments > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {task.comments}
                </span>
              )}
              {task.attachments > 0 && (
                <span className="flex items-center gap-1 text-xs">
                  <Paperclip className="h-3.5 w-3.5" />
                  {task.attachments}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarPreview() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dates = [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19, 20, 21],
    [22, 23, 24, 25, 26, 27, 28],
  ];

  const taskDates = {
    12: [{ title: 'Design mobile app', color: 'bg-primary' }],
    14: [{ title: 'Backend API', color: 'bg-destructive' }],
    15: [{ title: 'Competitor analysis', color: 'bg-warning' }],
    18: [{ title: 'Q4 Report', color: 'bg-primary' }, { title: 'Team meeting', color: 'bg-info' }],
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-lg font-semibold">December 2024</h3>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <button className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {days.map((day) => (
            <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Dates Grid */}
        {dates.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-t border-border">
            {week.map((date) => {
              const tasks = taskDates[date as keyof typeof taskDates];
              const isToday = date === 12;
              
              return (
                <div
                  key={date}
                  className={cn(
                    'min-h-[80px] md:min-h-[100px] p-1 md:p-2 border-r border-border last:border-r-0 hover:bg-muted/30 transition-colors cursor-pointer',
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center h-6 w-6 md:h-7 md:w-7 rounded-full text-xs md:text-sm',
                    isToday && 'bg-primary text-primary-foreground font-bold'
                  )}>
                    {date}
                  </span>
                  {tasks && (
                    <div className="mt-1 space-y-1">
                      {tasks.slice(0, 2).map((task, i) => (
                        <div
                          key={i}
                          className={cn(
                            'text-[10px] md:text-xs px-1.5 py-0.5 rounded truncate text-white',
                            task.color
                          )}
                        >
                          {task.title}
                        </div>
                      ))}
                      {tasks.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{tasks.length - 2} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

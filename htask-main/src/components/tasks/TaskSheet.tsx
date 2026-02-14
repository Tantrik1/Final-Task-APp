import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, MessageCircle, Paperclip, Link2, Info, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';
import { AssigneePicker } from './AssigneePicker';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { TaskLinks } from './TaskLinks';
import { useProjectStatuses } from '@/hooks/useProjectStatuses';

type TaskPriority = Database['public']['Enums']['task_priority'];
type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

interface TaskSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  projectId?: string;
  defaultStatusId?: string;
  onSuccess?: () => void;
}

export function TaskSheet({ open, onOpenChange, task, projectId, defaultStatusId, onSuccess }: TaskSheetProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: projectId || '',
    priority: 'medium' as TaskPriority,
    custom_status_id: '',
    due_date: undefined as Date | undefined,
    assigned_to: null as string | null,
  });

  // Fetch project statuses for the selected project
  const { statuses, isLoading: statusesLoading, getDefaultStatus } = useProjectStatuses(
    formData.project_id || projectId
  );

  // Reset form when task changes or sheet opens
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        project_id: task.project_id,
        priority: task.priority,
        custom_status_id: task.custom_status_id || '',
        due_date: task.due_date ? new Date(task.due_date) : undefined,
        assigned_to: task.assigned_to,
      });
      setActiveTab('details');
    } else {
      const initialStatusId = defaultStatusId || '';
      setFormData({
        title: '',
        description: '',
        project_id: projectId || '',
        priority: 'medium',
        custom_status_id: initialStatusId,
        due_date: undefined,
        assigned_to: null,
      });
      setActiveTab('details');
    }
  }, [task, projectId, defaultStatusId, open]);

  // Set default status when statuses load
  useEffect(() => {
    if (!formData.custom_status_id && statuses.length > 0 && !task) {
      const defaultStatus = getDefaultStatus();
      if (defaultStatus) {
        setFormData(prev => ({ ...prev, custom_status_id: defaultStatusId || defaultStatus.id }));
      }
    }
  }, [statuses, formData.custom_status_id, task, defaultStatusId, getDefaultStatus]);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!workspaceId) return;
      setIsLoading(true);
      
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false)
        .order('name');

      setProjects(data || []);
      setIsLoading(false);
    };

    if (open) {
      fetchProjects();
    }
  }, [workspaceId, open]);

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.project_id || !user) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in the title and select a project.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure we have a valid status ID - fall back to default if not set
      let statusId = formData.custom_status_id;
      if (!statusId && statuses.length > 0) {
        const defaultStatus = getDefaultStatus();
        statusId = defaultStatus?.id || statuses[0]?.id || '';
      }

      if (task) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            priority: formData.priority,
            custom_status_id: statusId || null,
            due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null,
            assigned_to: formData.assigned_to,
          })
          .eq('id', task.id);

        if (error) throw error;

        toast({ title: 'Task updated!' });
      } else {
        // Create new task - ALWAYS set a valid custom_status_id
        const { error } = await supabase.from('tasks').insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          project_id: formData.project_id,
          priority: formData.priority,
          custom_status_id: statusId || null,
          due_date: formData.due_date ? format(formData.due_date, 'yyyy-MM-dd') : null,
          assigned_to: formData.assigned_to,
          created_by: user.id,
        });

        if (error) throw error;

        toast({ title: 'Task created!' });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: 'Error',
        description: 'Failed to save task. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id);
      if (error) throw error;
      toast({ title: 'Task deleted' });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' });
    }
  };

  const priorityConfig = {
    low: { label: '⚪ Low', color: 'text-muted-foreground' },
    medium: { label: '🟡 Medium', color: 'text-warning' },
    high: { label: '🟠 High', color: 'text-orange-500' },
    urgent: { label: '🔴 Urgent', color: 'text-destructive' },
  };

  const renderStatusSelect = () => {
    if (statusesLoading) {
      return (
        <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      );
    }

    if (statuses.length === 0) {
      return (
        <div className="flex items-center h-10 px-3 border rounded-md bg-muted/50 text-sm text-muted-foreground">
          No statuses available
        </div>
      );
    }

    return (
      <Select
        value={formData.custom_status_id}
        onValueChange={(v) => setFormData({ ...formData, custom_status_id: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="h-2.5 w-2.5 rounded-full" 
                  style={{ backgroundColor: status.color }}
                />
                <span>{status.name}</span>
                {status.is_completed && <span className="text-xs text-muted-foreground">(Done)</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="text-left shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl">{task ? 'Edit Task' : 'New Task'}</SheetTitle>
              <SheetDescription>
                {task ? 'Update task details and collaborate' : 'Create a new task to track your work'}
              </SheetDescription>
            </div>
            {task && (
              <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        </SheetHeader>

        {task ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 mt-4">
            <TabsList className="shrink-0 w-full justify-start bg-muted/50 p-1 h-auto flex-wrap">
              <TabsTrigger value="details" className="gap-1.5 text-xs sm:text-sm">
                <Info className="h-3.5 w-3.5" />
                Details
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-1.5 text-xs sm:text-sm">
                <MessageCircle className="h-3.5 w-3.5" />
                Comments
              </TabsTrigger>
              <TabsTrigger value="attachments" className="gap-1.5 text-xs sm:text-sm">
                <Paperclip className="h-3.5 w-3.5" />
                Files
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-1.5 text-xs sm:text-sm">
                <Link2 className="h-3.5 w-3.5" />
                Links
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="details" className="mt-0 h-full">
                <div className="space-y-5 pb-24">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="What needs to be done?"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="text-lg h-12"
                    />
                  </div>

                  {/* Assignee */}
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <AssigneePicker
                      value={formData.assigned_to}
                      onChange={(value) => setFormData({ ...formData, assigned_to: value })}
                    />
                  </div>

                  {/* Priority & Status Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityConfig).map(([key, { label, color }]) => (
                            <SelectItem key={key} value={key}>
                              <span className={color}>{label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      {renderStatusSelect()}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal h-11',
                            !formData.due_date && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.due_date ? format(formData.due_date, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.due_date}
                          onSelect={(date) => setFormData({ ...formData, due_date: date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Add more details..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="mt-0 pb-6">
                <TaskComments taskId={task.id} />
              </TabsContent>

              <TabsContent value="attachments" className="mt-0 pb-6">
                <TaskAttachments taskId={task.id} />
              </TabsContent>

              <TabsContent value="links" className="mt-0 pb-6">
                <TaskLinks taskId={task.id} />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          /* New Task Form */
          <div className="flex-1 overflow-y-auto mt-4 pb-24">
            <div className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="What needs to be done?"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-lg h-12"
                />
              </div>

              {/* Project */}
              {!projectId && (
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(v) => setFormData({ ...formData, project_id: v, custom_status_id: '' })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : projects.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No projects found. Create one first.
                        </div>
                      ) : (
                        projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: p.color || '#6366f1' }}
                              />
                              {p.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Assignee */}
              <div className="space-y-2">
                <Label>Assignee</Label>
                <AssigneePicker
                  value={formData.assigned_to}
                  onChange={(value) => setFormData({ ...formData, assigned_to: value })}
                />
              </div>

              {/* Priority & Status Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityConfig).map(([key, { label, color }]) => (
                        <SelectItem key={key} value={key}>
                          <span className={color}>{label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  {renderStatusSelect()}
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal h-11',
                        !formData.due_date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => setFormData({ ...formData, due_date: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add more details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 brand-gradient"
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title.trim() || (!projectId && !formData.project_id)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : task ? (
              'Update Task'
            ) : (
              'Create Task'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

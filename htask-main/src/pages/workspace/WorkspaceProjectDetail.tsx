import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, LayoutGrid, List, Calendar as CalendarIcon, Plus, Settings, Sparkles } from 'lucide-react';
import { ProjectCalendarView } from '@/components/projects/ProjectCalendarView';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskSheet } from '@/components/tasks/TaskSheet';
import { ProjectSettingsDialog } from '@/components/projects/ProjectSettingsDialog';
import { Database } from '@/integrations/supabase/types';
import { useWorkspace } from '@/hooks/useWorkspace';

type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

export default function WorkspaceProjectDetail() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const isMobile = useIsMobile();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Default to list view on mobile, kanban on desktop
  const [activeView, setActiveView] = useState<'kanban' | 'list' | 'calendar'>(isMobile ? 'list' : 'kanban');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const fetchProject = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      toast({ title: 'Error', description: 'Project not found', variant: 'destructive' });
      navigate(`/workspace/${workspaceId}/projects`);
      return;
    }

    setProject(data);
  };

  const fetchTasks = async () => {
    if (!projectId) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    setTasks(data || []);
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchProject(), fetchTasks()]);
      setIsLoading(false);
    };
    loadData();
  }, [projectId]);

  const handleUpdate = () => {
    fetchTasks();
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/workspace/${workspaceId}/projects`)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ 
                backgroundColor: `${project.color || '#6366f1'}20`,
                boxShadow: `0 0 0 2px ${project.color || '#6366f1'}40`
              }}
            >
              <Sparkles
                className="h-6 w-6"
                style={{ color: project.color || '#6366f1' }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-muted-foreground truncate">{project.description}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button 
              variant="outline" 
              size="icon" 
              className="shrink-0"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => setAddTaskOpen(true)} className="brand-gradient gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Task</span>
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="kanban" className="flex-1 sm:flex-none gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1 sm:flex-none gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1 sm:flex-none gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-6">
          <KanbanBoard projectId={projectId!} tasks={tasks} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <TaskList projectId={projectId!} tasks={tasks} onUpdate={handleUpdate} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <ProjectCalendarView
            tasks={tasks}
            projectId={projectId!}
            projectColor={project.color}
            workspaceId={workspaceId}
            onAddTask={() => setAddTaskOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <TaskSheet
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        projectId={projectId}
        onSuccess={handleUpdate}
      />

      {/* Project Settings Dialog */}
      {project && (
        <ProjectSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          project={project}
        />
      )}
    </div>
  );
}

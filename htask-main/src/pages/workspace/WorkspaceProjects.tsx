import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, FolderKanban, Archive, Grid, List, Loader2, Copy, AlertCircle, Sparkles } from 'lucide-react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { TemplateManagerDialog } from '@/components/projects/TemplateManagerDialog';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectWithCounts extends Project {
  taskCounts?: { total: number; done: number };
}

export default function WorkspaceProjects() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentRole } = useWorkspace();
  const { 
    canCreateProject, 
    projectCount, 
    projectLimit,
    plan,
  } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
  });

  const canCreateProjectRole = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'member';
  const canManageProjects = currentRole === 'owner' || currentRole === 'admin';
  
  // Check both role and subscription limit
  const canCreate = canCreateProjectRole && canCreateProject;
  const projectUsagePercent = projectLimit ? (projectCount / projectLimit) * 100 : 0;

  const fetchProjects = async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', showArchived)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch task counts for each project
      const projectsWithCounts: ProjectWithCounts[] = await Promise.all(
        (data || []).map(async (project) => {
          const { count: totalCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id);

          const { count: doneCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .eq('status', 'done');

          return {
            ...project,
            taskCounts: { total: totalCount || 0, done: doneCount || 0 },
          };
        })
      );

      setProjects(projectsWithCounts);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [workspaceId, showArchived]);

  const handleCreateProject = async () => {
    if (!workspaceId || !user || !newProject.name.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('projects').insert({
        name: newProject.name.trim(),
        description: newProject.description.trim() || null,
        workspace_id: workspaceId,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: 'Project created!',
        description: `${newProject.name} has been created.`,
      });

      setNewProject({ name: '', description: '' });
      setIsCreateOpen(false);
      fetchProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveProject = async (project: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_archived: !project.is_archived })
        .eq('id', project.id);

      if (error) throw error;

      toast({
        title: project.is_archived ? 'Project restored' : 'Project archived',
      });

      fetchProjects();
    } catch (error) {
      console.error('Error archiving project:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id);

      if (error) throw error;

      toast({ title: 'Project deleted' });
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete project.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <FolderKanban className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Projects</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <span>Manage your workspace projects</span>
              {projectLimit && (
                <Badge variant="secondary" className="text-xs">
                  {projectCount}/{projectLimit}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived ? 'Active' : 'Archived'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplatesOpen(true)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Templates
          </Button>

          {canCreateProjectRole && (
            canCreate ? (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Add a new project to organize your tasks.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name *</Label>
                      <Input
                        id="project-name"
                        placeholder="e.g., Website Redesign"
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description (optional)</Label>
                      <Textarea
                        id="project-description"
                        placeholder="What is this project about?"
                        value={newProject.description}
                        onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateProject}
                        disabled={!newProject.name.trim() || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          'Create Project'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Button onClick={() => setUpgradeOpen(true)} variant="gradient">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            )
          )}
        </div>
      </div>

      {/* Project Limit Warning */}
      {projectLimit && projectUsagePercent >= 80 && !canCreateProject && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-warning-foreground">
                  Project limit reached
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You've used all {projectLimit} projects on the {plan?.name || 'current'} plan. 
                  Upgrade to create more projects.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={100} className="flex-1 h-2 bg-warning/20" />
                  <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    Upgrade
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Grid/List */}
      {isLoading ? (
        <div className={cn(
          'gap-4',
          viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'space-y-3'
        )}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {showArchived ? 'No archived projects' : 'No projects yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              {showArchived
                ? 'Archived projects will appear here.'
                : 'Create your first project to start organizing tasks.'}
            </p>
            {!showArchived && canCreate && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            )}
            {!showArchived && !canCreate && canCreateProjectRole && (
              <Button onClick={() => setUpgradeOpen(true)} variant="gradient">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Create
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          'gap-4',
          viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
        )}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              taskCounts={project.taskCounts}
              canManage={canManageProjects}
              onArchive={() => handleArchiveProject(project)}
              onDelete={() => handleDeleteProject(project)}
            />
          ))}
        </div>
      )}

      {/* Template Manager */}
      <TemplateManagerDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
      />

      {/* Upgrade Dialog */}
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}

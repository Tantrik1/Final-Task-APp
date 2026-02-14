import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FolderKanban, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectStats {
  id: string;
  name: string;
  color: string;
  totalTasks: number;
  completedTasks: number;
}

export function ProjectProgress() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!workspaceId) return;

      try {
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, name, color')
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(6);

        if (!projectsData || projectsData.length === 0) {
          setIsLoading(false);
          return;
        }

        const projectStats: ProjectStats[] = [];

        for (const project of projectsData) {
          const { count: totalCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id);

          const { count: completedCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .eq('status', 'done');

          projectStats.push({
            id: project.id,
            name: project.name,
            color: project.color || '#6366f1',
            totalTasks: totalCount || 0,
            completedTasks: completedCount || 0,
          });
        }

        setProjects(projectStats);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [workspaceId]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Project Progress</CardTitle>
          </div>
          <Link to={`/workspace/${workspaceId}/projects`}>
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderKanban className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No projects yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const completionRate = project.totalTasks > 0 
                ? Math.round((project.completedTasks / project.totalTasks) * 100) 
                : 0;

              return (
                <Link
                  key={project.id}
                  to={`/workspace/${workspaceId}/projects/${project.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-sm font-medium group-hover:text-primary transition-colors truncate max-w-[150px]">
                        {project.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {project.completedTasks}/{project.totalTasks} · {completionRate}%
                    </span>
                  </div>
                  <Progress 
                    value={completionRate} 
                    className="h-2"
                    style={{ 
                      '--progress-background': project.color 
                    } as React.CSSProperties}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

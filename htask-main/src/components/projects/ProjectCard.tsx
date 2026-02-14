import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FolderKanban, CheckSquare, MoreHorizontal, Archive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Project = Database['public']['Tables']['projects']['Row'];

interface ProjectCardProps {
  project: Project;
  taskCounts?: { total: number; done: number };
  canManage?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, taskCounts, canManage, onArchive, onDelete }: ProjectCardProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  
  const progress = taskCounts && taskCounts.total > 0
    ? Math.round((taskCounts.done / taskCounts.total) * 100)
    : 0;

  return (
    <Link to={`/workspace/${workspaceId}/projects/${project.id}`}>
      <Card 
        className={cn(
          'task-tile group relative overflow-hidden',
          project.is_archived && 'opacity-60'
        )}
      >
        {/* Animated color accent bar */}
        <div
          className="absolute inset-x-0 top-0 h-1.5 transition-all duration-300 group-hover:h-2"
          style={{ 
            background: `linear-gradient(90deg, ${project.color || 'hsl(var(--primary))'}, ${project.color || 'hsl(var(--primary))'}80)` 
          }}
        />

        <CardContent className="p-5 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${project.color || 'hsl(var(--primary))'}15` }}
              >
                <FolderKanban 
                  className="h-6 w-6" 
                  style={{ color: project.color || 'hsl(var(--primary))' }} 
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            {canManage && (
              <div onClick={(e) => e.preventDefault()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onArchive}>
                      <Archive className="h-4 w-4 mr-2" />
                      {project.is_archived ? 'Restore' : 'Archive'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 space-y-3">
            {taskCounts && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckSquare className="h-4 w-4" />
                    <span>{taskCounts.done} / {taskCounts.total} tasks</span>
                  </div>
                  <span className="font-medium" style={{ color: project.color || '#6366f1' }}>
                    {progress}%
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </>
            )}

            {project.is_archived && (
              <Badge variant="secondary" className="mt-2">
                Archived
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

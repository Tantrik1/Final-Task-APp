import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  FolderKanban,
  Calendar,
  ArrowRight,
  Plus,
  Clock,
  Building2,
  Sparkles,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { DashboardStatsGrid } from '@/components/dashboard/DashboardStatsGrid';
import { TeamActivityFeed } from '@/components/dashboard/TeamActivityFeed';
import { TaskCompletionChart } from '@/components/dashboard/TaskCompletionChart';
import { TopPerformers } from '@/components/dashboard/TopPerformers';
import { ProjectProgress } from '@/components/dashboard/ProjectProgress';

interface DashboardStats {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalMembers: number;
  overdueTasks: number;
  inProgressTasks: number;
  activeMembers: number;
  tasksThisWeek: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
  color: string | null;
}

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentWorkspace, currentRole } = useWorkspace();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<(Task & { project?: Project })[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdminOrOwner = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!workspaceId || !user) return;

      try {
        // Fetch projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, color')
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .limit(4);

        setRecentProjects(projects || []);

        // Fetch stats
        const { count: projectsCount } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false);

        const { count: membersCount } = await supabase
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);

        // Fetch active members (who have activity in last 24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const { count: activeCount } = await supabase
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('last_active_at', yesterday.toISOString());

        // Fetch tasks from workspace projects
        let totalTasks = 0;
        let completedTasks = 0;
        let overdueTasks = 0;
        let inProgressTasks = 0;
        let tasksThisWeek = 0;
        let upcoming: (Task & { project?: Project })[] = [];

        if (projects && projects.length > 0) {
          const projectIds = projects.map((p) => p.id);
          
          const { count: tasksCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds);

          const { count: doneCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .eq('status', 'done');

          const { count: inProgressCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .eq('status', 'in_progress');

          // Get all projects for overdue/week counts
          const { data: allProjects } = await supabase
            .from('projects')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('is_archived', false);

          if (allProjects) {
            const allProjectIds = allProjects.map(p => p.id);
            
            // Overdue tasks
            const { data: overdueTodos } = await supabase
              .from('tasks')
              .select('id, due_date')
              .in('project_id', allProjectIds)
              .neq('status', 'done')
              .not('due_date', 'is', null);

            overdueTasks = overdueTodos?.filter(t => 
              t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
            ).length || 0;

            // Tasks created this week
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);
            const { count: weekCount } = await supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .in('project_id', allProjectIds)
              .gte('created_at', weekStart.toISOString());

            tasksThisWeek = weekCount || 0;
          }

          // Fetch upcoming tasks
          const { data: upcomingData } = await supabase
            .from('tasks')
            .select('id, title, status, priority, due_date, project_id')
            .in('project_id', projectIds)
            .neq('status', 'done')
            .not('due_date', 'is', null)
            .order('due_date', { ascending: true })
            .limit(5);

          totalTasks = tasksCount || 0;
          completedTasks = doneCount || 0;
          inProgressTasks = inProgressCount || 0;
          
          // Map project names to tasks
          if (upcomingData) {
            upcoming = upcomingData.map((task) => ({
              ...task,
              project: projects.find((p) => p.id === task.project_id),
            }));
          }
        }

        setStats({
          totalProjects: projectsCount || 0,
          totalTasks,
          completedTasks,
          totalMembers: membersCount || 0,
          overdueTasks,
          inProgressTasks,
          activeMembers: activeCount || 0,
          tasksThisWeek,
        });
        setUpcomingTasks(upcoming);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [workspaceId, user]);

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const priorityColors = {
    low: 'bg-muted-foreground',
    medium: 'bg-warning',
    high: 'bg-orange-500',
    urgent: 'bg-destructive',
  };

  // Redirect members to My Tasks
  if (!isLoading && currentRole && !isAdminOrOwner) {
    return <Navigate to={`/workspace/${workspaceId}/my-tasks`} replace />;
  }

  // Show loading skeleton while determining role
  if (isLoading || !currentRole) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 flex items-center justify-center">
            {currentWorkspace?.logo_url ? (
              <img 
                src={currentWorkspace.logo_url} 
                alt={currentWorkspace.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <Building2 className="h-6 w-6 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              {currentWorkspace?.name || 'Dashboard'}
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {isAdminOrOwner ? 'Workspace Analytics' : 'Welcome back!'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/workspace/${workspaceId}/projects`}>
            <Button variant="outline" className="rounded-xl">
              <FolderKanban className="h-4 w-4 mr-2" />
              Projects
            </Button>
          </Link>
          <Link to={`/workspace/${workspaceId}/my-tasks`}>
            <Button className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              My Tasks
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <DashboardStatsGrid stats={stats} isLoading={isLoading} isAdmin={isAdminOrOwner} />

      {/* Admin Analytics Section */}
      {isAdminOrOwner && (
        <>
          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <TaskCompletionChart />
            <ProjectProgress />
          </div>

          {/* Activity and Leaderboard Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <TeamActivityFeed />
            <TopPerformers />
          </div>
        </>
      )}

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
            </div>
            <Link to={`/workspace/${workspaceId}/my-tasks`}>
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : upcomingTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No upcoming tasks with due dates</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((task) => {
                const isOverdue = task.due_date && isPast(new Date(task.due_date));
                
                return (
                  <Link
                    key={task.id}
                    to={`/workspace/${workspaceId}/projects/${task.project_id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn('h-2 w-2 rounded-full', priorityColors[task.priority as keyof typeof priorityColors])}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.project?.name}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs',
                        isOverdue && 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {task.due_date && formatDueDate(task.due_date)}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions for empty state */}
      {stats && stats.totalProjects === 0 && (
        <Card className="border-dashed bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create your first project to start organizing tasks and collaborating with your team.
            </p>
            <Link to={`/workspace/${workspaceId}/projects`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Performer {
  id: string;
  name: string;
  avatar?: string;
  completedTasks: number;
  totalTasks: number;
}

export function TopPerformers() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPerformers = async () => {
      if (!workspaceId) return;

      try {
        // Get workspace members
        const { data: members } = await supabase
          .from('workspace_members')
          .select(`
            user_id,
            profiles!workspace_members_user_id_fkey(id, full_name, email, avatar_url)
          `)
          .eq('workspace_id', workspaceId);

        if (!members || members.length === 0) {
          setIsLoading(false);
          return;
        }

        // Get projects
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false);

        if (!projects || projects.length === 0) {
          setIsLoading(false);
          return;
        }

        const projectIds = projects.map(p => p.id);
        const performerStats: Performer[] = [];

        for (const member of members) {
          const profile = member.profiles as any;
          if (!profile) continue;

          // Count completed tasks
          const { count: completedCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .eq('assigned_to', member.user_id)
            .eq('status', 'done');

          // Count total assigned tasks
          const { count: totalCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .eq('assigned_to', member.user_id);

          performerStats.push({
            id: profile.id,
            name: profile.full_name || profile.email?.split('@')[0] || 'Unknown',
            avatar: profile.avatar_url,
            completedTasks: completedCount || 0,
            totalTasks: totalCount || 0,
          });
        }

        // Sort by completed tasks
        performerStats.sort((a, b) => b.completedTasks - a.completedTasks);
        setPerformers(performerStats.slice(0, 5));
      } catch (error) {
        console.error('Error fetching performers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformers();
  }, [workspaceId]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 1:
        return <Medal className="h-4 w-4 text-gray-400" />;
      case 2:
        return <Award className="h-4 w-4 text-amber-600" />;
      default:
        return <span className="text-xs text-muted-foreground font-medium w-4 text-center">{index + 1}</span>;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-lg">Top Performers</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : performers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No task data yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {performers.map((performer, index) => {
              const completionRate = performer.totalTasks > 0 
                ? Math.round((performer.completedTasks / performer.totalTasks) * 100) 
                : 0;

              return (
                <div key={performer.id} className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-6">
                    {getRankIcon(index)}
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={performer.avatar} />
                    <AvatarFallback className={cn(
                      "text-xs",
                      index === 0 && "bg-yellow-100 text-yellow-700",
                      index === 1 && "bg-gray-100 text-gray-700",
                      index === 2 && "bg-amber-100 text-amber-700",
                      index > 2 && "bg-primary/10 text-primary"
                    )}>
                      {performer.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{performer.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {performer.completedTasks}/{performer.totalTasks}
                      </span>
                    </div>
                    <Progress value={completionRate} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

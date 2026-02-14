import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  CheckCircle2,
  PlayCircle,
  PlusCircle,
  Edit3,
  Trash2,
  UserPlus,
  MessageSquare,
  FileIcon,
  LinkIcon,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  action_type: string;
  entity_type: string;
  description: string;
  created_at: string;
  metadata: any;
  project_id?: string;
  actor: {
    full_name: string;
    email: string;
    avatar_url?: string;
  } | null;
  project?: {
    name: string;
    color: string;
  } | null;
}

export function TeamActivityFeed() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!workspaceId) return;

      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select(`
            *,
            actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url),
            project:projects(name, color)
          `)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        setActivities(data || []);
      } catch (error) {
        console.error('Error fetching activity:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('activity_feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          // Fetch full data for the new log
          const { data } = await supabase
            .from('activity_logs')
            .select(`
              *,
              actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url),
              project:projects(name, color)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setActivities(prev => [data, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [workspaceId]);

  const getActivityIcon = (type: string, entityType: string) => {
    switch (type) {
      case 'create': return <PlusCircle className="h-4 w-4 text-primary" />;
      case 'update': return <Edit3 className="h-4 w-4 text-blue-500" />;
      case 'delete':
      case 'delete_file':
      case 'remove_link':
        return <Trash2 className="h-4 w-4 text-destructive" />;
      case 'complete': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'timer_start':
      case 'timer_resume': return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'timer_pause': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'join':
      case 'assign':
      case 'unassign': return <UserPlus className="h-4 w-4 text-purple-500" />;
      case 'comment': return <MessageSquare className="h-4 w-4 text-indigo-500" />;
      case 'upload': return <FileIcon className="h-4 w-4 text-orange-400" />;
      case 'add_link': return <LinkIcon className="h-4 w-4 text-blue-400" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Team Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] lg:h-[400px] px-6 pb-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 group">
                  <div className="relative">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={activity.actor?.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {activity.actor?.full_name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border flex items-center justify-center">
                      {getActivityIcon(activity.action_type, activity.entity_type)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/90">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {activity.project && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0"
                          style={{
                            backgroundColor: `${activity.project.color}15`,
                            color: activity.project.color
                          }}
                        >
                          {activity.project.name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

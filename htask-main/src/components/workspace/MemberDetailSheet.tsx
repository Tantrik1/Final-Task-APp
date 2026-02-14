import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Crown, Shield, User, Eye, CheckCircle2, MessageSquare, 
  Clock, Calendar, Activity, ListTodo, Send, FileText,
  TrendingUp, LogIn, Briefcase
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type WorkspaceRole = Database['public']['Enums']['workspace_role'];

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  last_active_at: string | null;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    needs_password_reset: boolean | null;
  };
}

interface MemberStats {
  tasksAssigned: number;
  tasksCompleted: number;
  commentsCount: number;
  messagesCount: number;
}

interface ActivityItem {
  id: string;
  type: 'task_created' | 'task_completed' | 'task_assigned' | 'comment_added' | 'message_sent' | 'login';
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface MemberDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberWithProfile | null;
  workspaceId: string;
  canManage: boolean;
  onResendCredentials?: (member: MemberWithProfile) => void;
  onManageMember?: (member: MemberWithProfile) => void;
}

const roleIcons: Record<WorkspaceRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: 'bg-role-owner/10 text-role-owner border-role-owner/20',
  admin: 'bg-role-admin/10 text-role-admin border-role-admin/20',
  member: 'bg-role-member/10 text-role-member border-role-member/20',
  viewer: 'bg-role-viewer/10 text-role-viewer border-role-viewer/20',
};

export function MemberDetailSheet({
  open,
  onOpenChange,
  member,
  workspaceId,
  canManage,
  onResendCredentials,
  onManageMember,
}: MemberDetailSheetProps) {
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open && member) {
      fetchMemberData();
    }
  }, [open, member]);

  const fetchMemberData = async () => {
    if (!member || !workspaceId) return;
    setIsLoading(true);

    try {
      // Fetch stats in parallel
      const [tasksResult, completedResult, commentsResult, messagesResult, recentTasksResult] = await Promise.all([
        // Tasks assigned to member
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', member.user_id),
        
        // Tasks completed by member
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', member.user_id)
          .not('completed_at', 'is', null),
        
        // Comments made by member
        supabase
          .from('task_comments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', member.user_id),
        
        // Messages sent by member in workspace channels
        supabase
          .from('messages')
          .select('id, channels!inner(workspace_id)', { count: 'exact', head: true })
          .eq('sender_id', member.user_id)
          .eq('channels.workspace_id', workspaceId),
        
        // Recent tasks assigned to member
        supabase
          .from('tasks')
          .select(`
            id,
            title,
            completed_at,
            due_date,
            created_at,
            custom_status_id,
            project_statuses!tasks_custom_status_id_fkey (name, color)
          `)
          .eq('assigned_to', member.user_id)
          .order('updated_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        tasksAssigned: tasksResult.count || 0,
        tasksCompleted: completedResult.count || 0,
        commentsCount: commentsResult.count || 0,
        messagesCount: messagesResult.count || 0,
      });

      setRecentTasks(recentTasksResult.data || []);

      // Build activity timeline
      await fetchActivityTimeline();
    } catch (error) {
      console.error('Error fetching member data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityTimeline = async () => {
    if (!member || !workspaceId) return;

    try {
      // Fetch recent activities from various sources
      const [tasksCreated, tasksCompleted, comments, messages] = await Promise.all([
        // Tasks created by member
        supabase
          .from('tasks')
          .select('id, title, created_at, projects!inner(workspace_id, name)')
          .eq('created_by', member.user_id)
          .eq('projects.workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Tasks completed by member
        supabase
          .from('tasks')
          .select('id, title, completed_at, projects!inner(workspace_id, name)')
          .eq('assigned_to', member.user_id)
          .eq('projects.workspace_id', workspaceId)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(10),
        
        // Recent comments
        supabase
          .from('task_comments')
          .select(`
            id, 
            content, 
            created_at, 
            tasks!inner(
              id, 
              title, 
              projects!inner(workspace_id)
            )
          `)
          .eq('user_id', member.user_id)
          .eq('tasks.projects.workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Recent messages
        supabase
          .from('messages')
          .select('id, content, created_at, channels!inner(workspace_id, name)')
          .eq('sender_id', member.user_id)
          .eq('channels.workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      // Combine and sort activities
      const allActivities: ActivityItem[] = [];

      // Add tasks created
      (tasksCreated.data || []).forEach(task => {
        allActivities.push({
          id: `task-created-${task.id}`,
          type: 'task_created',
          title: 'Created a task',
          description: task.title,
          timestamp: task.created_at,
          metadata: { projectName: task.projects?.name },
        });
      });

      // Add tasks completed
      (tasksCompleted.data || []).forEach(task => {
        if (task.completed_at) {
          allActivities.push({
            id: `task-completed-${task.id}`,
            type: 'task_completed',
            title: 'Completed a task',
            description: task.title,
            timestamp: task.completed_at,
            metadata: { projectName: task.projects?.name },
          });
        }
      });

      // Add comments
      (comments.data || []).forEach(comment => {
        allActivities.push({
          id: `comment-${comment.id}`,
          type: 'comment_added',
          title: 'Added a comment',
          description: comment.tasks?.title || 'Task',
          timestamp: comment.created_at,
        });
      });

      // Add messages
      (messages.data || []).forEach(msg => {
        allActivities.push({
          id: `message-${msg.id}`,
          type: 'message_sent',
          title: `Messaged in #${msg.channels?.name}`,
          description: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
          timestamp: msg.created_at,
        });
      });

      // Add login activity (last_active_at)
      if (member.last_active_at) {
        allActivities.push({
          id: 'last-login',
          type: 'login',
          title: 'Last seen',
          description: 'Active in workspace',
          timestamp: member.last_active_at,
        });
      }

      // Sort by timestamp descending
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(allActivities.slice(0, 20));
    } catch (error) {
      console.error('Error fetching activity timeline:', error);
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'task_created':
        return <ListTodo className="h-4 w-4" />;
      case 'task_completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'task_assigned':
        return <User className="h-4 w-4" />;
      case 'comment_added':
        return <MessageSquare className="h-4 w-4" />;
      case 'message_sent':
        return <Send className="h-4 w-4" />;
      case 'login':
        return <LogIn className="h-4 w-4 text-primary" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (!member) return null;

  const RoleIcon = roleIcons[member.role];
  const needsSetup = member.profiles.needs_password_reset === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 rounded-xl">
                <AvatarImage src={member.profiles.avatar_url || undefined} />
                <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-xl">
                  {(member.profiles.full_name || member.profiles.email)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <span className={cn(
                "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background",
                needsSetup ? "bg-warning" : member.last_active_at && new Date(member.last_active_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? "bg-success" : "bg-muted-foreground/40"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl">
                {member.profiles.full_name || member.profiles.email.split('@')[0]}
              </SheetTitle>
              <p className="text-sm text-muted-foreground truncate">{member.profiles.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge 
                  variant="outline" 
                  className={cn(roleColors[member.role], 'text-xs px-2 py-0.5 rounded-lg')}
                >
                  <RoleIcon className="h-3 w-3 mr-1" />
                  <span className="capitalize">{member.role}</span>
                </Badge>
                {needsSetup && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-lg bg-warning/10 text-warning border-warning/20">
                    <Clock className="h-3 w-3 mr-1" />
                    Awaiting login
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Quick Actions */}
            {canManage && (
              <div className="flex gap-2">
                {needsSetup && onResendCredentials && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl flex-1"
                    onClick={() => onResendCredentials(member)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Resend Credentials
                  </Button>
                )}
                {onManageMember && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl flex-1"
                    onClick={() => onManageMember(member)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                )}
              </div>
            )}

            {/* Member Info Card */}
            <Card className="rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Joined
                  </span>
                  <span className="font-medium">
                    {format(new Date(member.joined_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Last Active
                  </span>
                  <span className="font-medium">
                    {member.last_active_at 
                      ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })
                      : needsSetup ? 'Never (awaiting setup)' : 'Never'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-primary">{stats?.tasksAssigned || 0}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Tasks Assigned</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  ) : (
                    <p className="text-2xl font-bold text-success">{stats?.tasksCompleted || 0}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Completed</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.commentsCount || 0}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Comments</p>
                </CardContent>
              </Card>
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  {isLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  ) : (
                    <p className="text-2xl font-bold">{stats?.messagesCount || 0}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Messages</p>
                </CardContent>
              </Card>
            </div>

            {/* Completion Rate */}
            {stats && stats.tasksAssigned > 0 && (
              <Card className="rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Completion Rate
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {Math.round((stats.tasksCompleted / stats.tasksAssigned) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                      style={{ width: `${(stats.tasksCompleted / stats.tasksAssigned) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs for Activities and Tasks */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full h-auto p-1 bg-muted/50 rounded-xl">
                <TabsTrigger value="overview" className="flex-1 rounded-lg py-2 text-xs">
                  <Activity className="h-3.5 w-3.5 mr-1.5" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="tasks" className="flex-1 rounded-lg py-2 text-xs">
                  <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                  Recent Tasks
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-3 space-y-2">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-3 p-3">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activities.length > 0 ? (
                  <div className="space-y-1">
                    {activities.map((activity) => (
                      <div 
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No activity yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-3 space-y-2">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="p-3">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    ))}
                  </div>
                ) : recentTasks.length > 0 ? (
                  <div className="space-y-1">
                    {recentTasks.map((task) => (
                      <div 
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          task.completed_at ? "bg-success/10" : "bg-muted"
                        )}>
                          {task.completed_at ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium truncate",
                            task.completed_at && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.project_statuses && (
                              <Badge 
                                variant="outline" 
                                className="text-[10px] px-1.5 py-0 h-4 rounded"
                                style={{ 
                                  backgroundColor: `${task.project_statuses.color}15`,
                                  borderColor: `${task.project_statuses.color}40`,
                                  color: task.project_statuses.color 
                                }}
                              >
                                {task.project_statuses.name}
                              </Badge>
                            )}
                            {task.due_date && (
                              <span className="text-[10px] text-muted-foreground">
                                Due {format(new Date(task.due_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks assigned</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

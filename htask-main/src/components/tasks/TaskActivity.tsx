import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Activity,
    CheckCircle2,
    PlayCircle,
    PauseCircle,
    PlusCircle,
    Edit3,
    Trash2,
    UserPlus,
    UserMinus,
    MessageSquare,
    MessageCircle,
    Paperclip,
    Link2,
    Clock,
    Archive,
    RotateCcw,
    ArrowRight,
    FolderKanban,
    Building2,
    Shield,
    ListPlus,
    ListMinus,
    ArrowUpDown,
    Pencil,
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityLog {
    id: string;
    action_type: string;
    entity_type: string;
    description: string;
    created_at: string;
    metadata: any;
    task_id?: string;
    project_id?: string;
    actor_id?: string;
    actor: {
        full_name: string;
        email: string;
        avatar_url?: string;
    } | null;
}

interface TaskActivityProps {
    taskId: string;
}

const getActivityIcon = (type: string, entityType: string) => {
    switch (type) {
        // Task
        case 'create':
            if (entityType === 'project') return { Icon: FolderKanban, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' };
            return { Icon: PlusCircle, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
        case 'update':
            if (entityType === 'workspace') return { Icon: Building2, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' };
            if (entityType === 'task') return { Icon: Edit3, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' };
            return { Icon: Edit3, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };
        case 'delete':
        case 'delete_file':
        case 'remove_link':
        case 'delete_comment':
            return { Icon: Trash2, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
        case 'archive': return { Icon: Archive, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };
        case 'restore': return { Icon: RotateCcw, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
        case 'move': return { Icon: ArrowRight, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' };
        case 'rename': return { Icon: Pencil, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };

        // Comments
        case 'comment': return { Icon: MessageCircle, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' };
        case 'comment_reply': return { Icon: MessageSquare, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30' };
        case 'edit_comment': return { Icon: Edit3, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };

        // Files & Links
        case 'upload': return { Icon: Paperclip, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
        case 'add_link': return { Icon: Link2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };

        // Assignee
        case 'assign': return { Icon: UserPlus, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' };
        case 'unassign': return { Icon: UserMinus, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };

        // Timer
        case 'timer_start':
        case 'timer_resume': return { Icon: PlayCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
        case 'timer_pause': return { Icon: PauseCircle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' };

        // Members
        case 'join': return { Icon: UserPlus, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
        case 'remove_member': return { Icon: UserMinus, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
        case 'update_role': return { Icon: Shield, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' };

        // Project Statuses
        case 'add_status': return { Icon: ListPlus, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
        case 'rename_status': return { Icon: Pencil, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
        case 'delete_status': return { Icon: ListMinus, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
        case 'reorder_status': return { Icon: ArrowUpDown, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };

        default: return { Icon: Activity, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };
    }
};

function formatActivityTime(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        if (isToday(date)) return formatDistanceToNow(date, { addSuffix: true });
        if (isYesterday(date)) return 'Yesterday, ' + format(date, 'h:mm a');
        return format(date, 'MMM d, h:mm a');
    } catch {
        return '';
    }
}

function formatFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
        status: '📊 Status',
        priority: '🔥 Priority',
        due_date: '📅 Due Date',
        title: '✏️ Title',
        description: '📝 Description',
        assigned_to: '👤 Assignee',
        project_id: '📁 Project',
        name: '✏️ Name',
        logo_url: '🖼️ Logo',
        color: '🎨 Color',
    };
    return fieldMap[field] || field;
}

export function TaskActivity({ taskId }: TaskActivityProps) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchActivityLogs = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('activity_logs' as any)
                .select(`
          *,
          actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url)
        `)
                .eq('task_id', taskId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setActivities((data as any) || []);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        } finally {
            setIsLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        fetchActivityLogs();

        // Subscribe to real-time changes
        const channel = supabase
            .channel(`task-activity-${taskId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: `task_id=eq.${taskId}`,
                },
                async (payload) => {
                    // Fetch full data for the new log
                    const { data } = await supabase
                        .from('activity_logs' as any)
                        .select(`
              *,
              actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url)
            `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        setActivities((prev) => [(data as any), ...prev]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [taskId, fetchActivityLogs]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (activities.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs mt-1">Actions on this task will appear here</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>Activity Timeline ({activities.length})</span>
            </div>

            <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-0 relative">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-10 bottom-10 w-0.5 bg-border" />

                    {activities.map((activity, index) => {
                        const { Icon, color, bg } = getActivityIcon(activity.action_type, activity.entity_type);
                        const actorName = activity.actor?.full_name || activity.actor?.email?.split('@')[0] || 'Someone';
                        const initials = activity.actor?.full_name
                            ? activity.actor.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                            : activity.actor?.email?.[0]?.toUpperCase() || '?';

                        return (
                            <div key={activity.id} className="relative flex items-start gap-3 pb-6">
                                {/* Icon */}
                                <div className={cn('relative z-10 h-10 w-10 rounded-full flex items-center justify-center shrink-0', bg)}>
                                    <Icon className={cn('h-5 w-5', color)} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 pt-1">
                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                        {activity.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="text-xs text-muted-foreground">
                                            {formatActivityTime(activity.created_at)}
                                        </span>
                                        {activity.metadata?.field && (
                                            <Badge variant="secondary" className="text-xs px-2 py-0 h-5">
                                                {formatFieldName(activity.metadata.field)}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}

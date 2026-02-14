import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ActivityLog } from '@/components/ActivityItem';

export type NotificationType =
    | 'task_assigned'
    | 'task_status_changed'
    | 'task_completed'
    | 'task_updated'
    | 'task_due_soon'
    | 'task_overdue'
    | 'comment_added'
    | 'comment_reply'
    | 'project_created'
    | 'project_updated'
    | 'member_joined'
    | 'member_invited'
    | 'workspace_invite_accepted'
    | 'role_changed'
    | 'chat_mention'
    | 'due_date_reminder';

export type EntityType = 'task' | 'project' | 'comment' | 'chat' | 'workspace' | 'member';

export interface Notification {
    id: string;
    workspace_id: string;
    user_id: string;
    actor_id: string | null;
    type: NotificationType;
    title: string;
    body: string;
    entity_type: EntityType;
    entity_id: string;
    metadata: any;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    actor: {
        id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
    } | null;
}

export interface NotificationPreferences {
    id: string;
    user_id: string;
    workspace_id: string;
    task_assigned: boolean;
    task_status_changed: boolean;
    task_completed: boolean;
    comment_added: boolean;
    comment_reply: boolean;
    project_updates: boolean;
    member_updates: boolean;
    chat_mentions: boolean;
    due_date_reminders: boolean;
}

// Deep link resolver
export function getNotificationDeepLink(notification: Notification): string {
    const { entity_type, entity_id, metadata } = notification;

    switch (entity_type) {
        case 'task':
            return `/task/${entity_id}`;
        case 'project':
            return `/(tabs)/projects`;
        case 'comment':
            // Comments link to the task
            if (metadata?.task_id) return `/task/${metadata.task_id}`;
            return `/(tabs)/projects`;
        case 'chat':
            if (metadata?.is_dm && metadata?.conversation_id) {
                return `/(tabs)/chat`;
            }
            return `/(tabs)/chat`;
        case 'workspace':
        case 'member':
            return `/(tabs)/members`;
        default:
            return `/(tabs)`;
    }
}

const NOTIFICATION_SELECT = `
    *,
    actor:profiles!notifications_actor_id_fkey(id, email, full_name, avatar_url)
`;

const INITIAL_LIMIT = 15;
const PAGE_SIZE = 20;

export function useNotifications() {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [hasNewNotification, setHasNewNotification] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Fetch UNREAD notifications first (fast, small dataset)
    const fetchNotifications = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id) return;

        try {
            // Step 1: Get all unread notifications (these are the important ones)
            const { data: unreadData, error: unreadError } = await supabase
                .from('notifications')
                .select(NOTIFICATION_SELECT)
                .eq('workspace_id', currentWorkspace.id)
                .eq('user_id', user.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            if (unreadError) throw unreadError;

            const unread = (unreadData || []) as Notification[];
            setUnreadCount(unread.length);

            // Step 2: Get a small batch of recent read notifications for context
            const { data: recentRead, error: readError } = await supabase
                .from('notifications')
                .select(NOTIFICATION_SELECT)
                .eq('workspace_id', currentWorkspace.id)
                .eq('user_id', user.id)
                .eq('is_read', true)
                .order('created_at', { ascending: false })
                .limit(INITIAL_LIMIT);

            if (readError) throw readError;

            const read = (recentRead || []) as Notification[];

            // Merge unread first, then recent read
            const merged = [...unread, ...read].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setNotifications(merged);
            setHasMore(read.length >= INITIAL_LIMIT);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, currentWorkspace?.id]);

    // Load older (read) notifications — pagination
    const loadOlderNotifications = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id || !hasMore || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            // Get the oldest notification we currently have
            const readNotifications = notifications.filter(n => n.is_read);
            const oldestRead = readNotifications[readNotifications.length - 1];
            if (!oldestRead) {
                setHasMore(false);
                setIsLoadingMore(false);
                return;
            }

            const { data, error } = await supabase
                .from('notifications')
                .select(NOTIFICATION_SELECT)
                .eq('workspace_id', currentWorkspace.id)
                .eq('user_id', user.id)
                .eq('is_read', true)
                .lt('created_at', oldestRead.created_at)
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);

            if (error) throw error;

            const older = (data || []) as Notification[];
            if (older.length < PAGE_SIZE) setHasMore(false);

            setNotifications(prev => {
                const existingIds = new Set(prev.map(n => n.id));
                const newOnes = older.filter(n => !existingIds.has(n.id));
                return [...prev, ...newOnes];
            });
        } catch (error) {
            console.error('Error loading older notifications:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [user?.id, currentWorkspace?.id, hasMore, isLoadingMore, notifications]);

    // Fetch Project/Task Activity for the "Projects" tab
    const fetchProjectActivity = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id) return [];

        try {
            const role = currentWorkspace.role || 'viewer';
            let query = supabase
                .from('activity_logs')
                .select(`
                    *,
                    actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url)
                `)
                .eq('workspace_id', currentWorkspace.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (role === 'member' || role === 'viewer') {
                const { data: myTasks } = await supabase
                    .from('tasks')
                    .select('id')
                    .eq('assigned_to', user.id);

                const taskIds = myTasks?.map(t => t.id) || [];

                if (taskIds.length > 0) {
                    const idsString = taskIds.join(',');
                    query = query.or(`entity_type.neq.task,task_id.in.(${idsString})`);
                } else {
                    query = query.neq('entity_type', 'task');
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as ActivityLog[];
        } catch (error) {
            console.error('Error fetching project activity:', error);
            return [];
        }
    }, [user?.id, currentWorkspace]);

    // Fetch preferences
    const fetchPreferences = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id) return;

        try {
            const { data, error } = await supabase
                .from('notification_preferences')
                .select('*')
                .eq('user_id', user.id)
                .eq('workspace_id', currentWorkspace.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setPreferences(data as NotificationPreferences);
            } else {
                const { data: newRow, error: insertError } = await supabase
                    .from('notification_preferences')
                    .insert({
                        user_id: user.id,
                        workspace_id: currentWorkspace.id,
                    })
                    .select()
                    .single();

                if (insertError) {
                    console.error('Error creating default preferences:', insertError);
                } else {
                    setPreferences(newRow as NotificationPreferences);
                }
            }
        } catch (error) {
            console.error('Error fetching preferences:', error);
        }
    }, [user?.id, currentWorkspace?.id]);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) throw error;

            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
                )
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('workspace_id', currentWorkspace.id)
                .eq('is_read', false);

            if (error) throw error;

            setNotifications((prev) =>
                prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }, [user?.id, currentWorkspace?.id]);

    const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
        if (!user?.id || !currentWorkspace?.id) return;

        try {
            if (preferences) {
                const { error } = await supabase
                    .from('notification_preferences')
                    .update(updates)
                    .eq('id', preferences.id);

                if (error) throw error;
                setPreferences((prev) => prev ? { ...prev, ...updates } : null);
            } else {
                const { data, error } = await supabase
                    .from('notification_preferences')
                    .insert({
                        user_id: user.id,
                        workspace_id: currentWorkspace.id,
                        ...updates,
                    })
                    .select()
                    .single();

                if (error) throw error;
                setPreferences(data as NotificationPreferences);
            }
        } catch (error: any) {
            console.error('Error updating preferences:', error);
            Alert.alert('Error', 'Failed to update preferences: ' + error.message);
        }
    }, [user?.id, currentWorkspace?.id, preferences]);

    // Set up real-time subscription
    useEffect(() => {
        if (!user?.id || !currentWorkspace?.id) return;

        fetchNotifications();
        fetchPreferences();

        let channel: RealtimeChannel;

        const setupSubscription = () => {
            channel = supabase
                .channel(`notifications:${user.id}:${currentWorkspace.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    async (payload) => {
                        const { data } = await supabase
                            .from('notifications')
                            .select(NOTIFICATION_SELECT)
                            .eq('id', payload.new.id)
                            .single();

                        if (data) {
                            setNotifications((prev) => [data as Notification, ...prev]);
                            setUnreadCount((prev) => prev + 1);
                            setHasNewNotification(true);
                            setTimeout(() => setHasNewNotification(false), 2000);
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        setNotifications((prev) =>
                            prev.map((n) =>
                                n.id === payload.new.id ? { ...n, ...payload.new } : (n as any)
                            )
                        );
                    }
                )
                .subscribe();
        };

        setupSubscription();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [user?.id, currentWorkspace?.id, fetchNotifications, fetchPreferences]);

    return {
        notifications,
        unreadCount,
        isLoading,
        preferences,
        hasNewNotification,
        hasMore,
        isLoadingMore,
        fetchNotifications,
        fetchProjectActivity,
        loadOlderNotifications,
        markAsRead,
        markAllAsRead,
        updatePreferences,
    };
}

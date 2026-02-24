import { useState, useCallback, useEffect, useRef } from 'react';
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

const MIN_ITEMS_TO_SHOW = 10;
const PAGE_SIZE = 20;

export interface UseNotificationsReturn {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    preferences: NotificationPreferences | null;
    hasNewNotification: boolean;
    hasMore: boolean;
    isLoadingMore: boolean;
    fetchNotifications: () => Promise<void>;
    fetchProjectActivity: () => Promise<ActivityLog[]>;
    loadOlderNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const { user } = useAuth();
    const { currentWorkspace } = useWorkspace();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [hasNewNotification, setHasNewNotification] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    // BUG-08 FIX: Keep a ref in sync with notifications state so loadOlderNotifications
    // can always read the latest list without capturing it in the closure.
    const notificationsRef = useRef<Notification[]>([]);
    useEffect(() => { notificationsRef.current = notifications; }, [notifications]);

    // Debug logging
    // useEffect(() => {
    //     console.log('useNotifications mounted/updated');
    // }, []);

    // Fetch notifications (Unread first, then fill with read if needed)
    const fetchNotifications = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id) return;

        try {
            setIsLoading(true);

            // Step 1: Get ALL unread notifications
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

            let merged = [...unread];

            // Step 2: If we have fewer than MIN_ITEMS_TO_SHOW unread, fetch read notifications to fill the gap
            // Or if user just wants "last 10" combined. 
            // The requirement: "if all seen or unseen is less than 10 then load atleast last 10 notifications, if unseen is >10 then show all unseen."

            // Logic:
            // Always fetch some read notifications if active unread count is low to provide context.
            // If unread > 10, we have enough content.
            // If unread < 10, we need (10 - unread) read items.

            const needed = Math.max(0, MIN_ITEMS_TO_SHOW - unread.length);

            // Even if we have 10 unread, let's fetch a few read ones just in case user switched filter to "All" and expects some history?
            // User requirement specifically focuses on "load atleast last 10".
            // So if unread=12, we show 12 unread. (and maybe 0 read initially? logic implies show all unseen).
            // But if user switches to "Read" tab, we need data.
            // So let's always fetch at least some read items for the "Read" tab or "All" tab history.
            // For now, adhere strictly to "load at least last 10".

            if (needed > 0) {
                const { data: readData, error: readError } = await supabase
                    .from('notifications')
                    .select(NOTIFICATION_SELECT)
                    .eq('workspace_id', currentWorkspace.id)
                    .eq('user_id', user.id)
                    .eq('is_read', true)
                    .order('created_at', { ascending: false })
                    .limit(needed + 5); // Fetch a bit more for buffer

                if (readError) throw readError;

                const read = (readData || []) as Notification[];
                merged = [...merged, ...read];
            }

            // Sort by date desc
            merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setNotifications(merged);
            // Has more if we fetched the limit of read items? 
            // Simplified: accurate hasMore would require count, but for infinite scroll we can just assume true if we got full page
            setHasMore(true);
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
            // BUG-08 FIX: Access notifications via ref to avoid stale closure.
            // notificationsRef is kept in sync with state via a useEffect below.
            const readNotifications = notificationsRef.current.filter((n: Notification) => n.is_read);
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
    }, [user?.id, currentWorkspace?.id, hasMore, isLoadingMore]);
    // BUG-08 FIX: The notifications array is read via ref (see notificationsRef below)
    // so we can drop it from deps. This prevents a new callback on every realtime
    // notification which would make the stale closure problem re-occur.

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
    }, [user?.id, currentWorkspace?.id]);

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

    // ─── Mark as Read (Optimistic) ─────────────────────────────
    const markAsRead = useCallback(async (notificationId: string) => {
        // 1. Optimistic Update
        setNotifications(prev =>
            prev.map(n =>
                n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
            )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (error) {
                // Revert on error (optional, but good practice)
                console.error('Error marking read, reverting...', error);
                // For now, we just log. Reverting UI might be jarring if it was just a network blip.
                // You could implement a revert logic here if strict consistency is needed.
                throw error;
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }, []);

    // ─── Mark All as Read (Optimistic) ─────────────────────────
    const markAllAsRead = useCallback(async () => {
        if (!user?.id || !currentWorkspace?.id) return;

        // 1. Optimistic Update
        const now = new Date().toISOString();
        setNotifications(prev =>
            prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || now }))
        );
        setUnreadCount(0);

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: now })
                .eq('user_id', user.id)
                .eq('workspace_id', currentWorkspace.id)
                .eq('is_read', false);

            if (error) throw error;
        } catch (error) {
            console.error('Error marking all as read:', error);
            // Ideally revert here too if critical
            Alert.alert('Error', 'Failed to mark notifications as read.');
            fetchNotifications(); // Re-fetch to sync state
        }
    }, [user?.id, currentWorkspace?.id, fetchNotifications]);

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

    // ─── Realtime Subscription ─────────────────────────────────
    useEffect(() => {
        if (!user?.id || !currentWorkspace?.id) return;

        fetchNotifications();
        fetchPreferences();

        const channel = supabase
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
                    // Fetch full data for the new notification (to get actor details)
                    const { data } = await supabase
                        .from('notifications')
                        .select(NOTIFICATION_SELECT)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        setNotifications((prev) => {
                            // Deduplicate just in case
                            if (prev.some(n => n.id === data.id)) return prev;
                            return [data as Notification, ...prev];
                        });
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
                    setNotifications((prev) => {
                        const updated = prev.map((n) =>
                            n.id === payload.new.id ? { ...n, ...payload.new } : n
                        );
                        // Recalculate unread count from the updated list
                        setUnreadCount(updated.filter(n => !n.is_read).length);
                        return updated;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // BUG-03 FIX: Only depend on primitive IDs, NOT on function callbacks
        // (fetchNotifications/fetchPreferences change reference every render when
        // currentWorkspace object changes, causing duplicate channel subscriptions)
    }, [user?.id, currentWorkspace?.id]);

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

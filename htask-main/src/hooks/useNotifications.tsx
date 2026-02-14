import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

export type EntityType = 'task' | 'project' | 'comment' | 'chat' | 'workspace';

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
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  actor?: {
    id: string;
    email: string;
    full_name: string | null;
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
  push_enabled?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: number;
  quiet_hours_end?: number;
  push_soft_declined_at?: string | null;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

// Helper to build deep-link URL for notifications
function getNotificationUrl(notification: {
  workspace_id: string;
  entity_type: EntityType;
  entity_id: string;
  metadata?: Record<string, unknown> | null;
}): string {
  const workspaceId = notification.workspace_id;
  const metadata = (notification.metadata || {}) as Record<string, unknown>;

  switch (notification.entity_type) {
    case 'task':
      return `/workspace/${workspaceId}/projects/${metadata?.project_id || ''}/tasks/${notification.entity_id}`;
    case 'project':
      return `/workspace/${workspaceId}/projects/${notification.entity_id}`;
    case 'comment':
      return `/workspace/${workspaceId}/projects/${metadata?.project_id || ''}/tasks/${metadata?.task_id || ''}`;
    case 'chat':
      // Check if it's a DM or channel
      if (metadata?.is_dm && metadata?.conversation_id) {
        return `/workspace/${workspaceId}/chat?dm=${metadata.conversation_id}`;
      }
      if (metadata?.channel_id) {
        return `/workspace/${workspaceId}/chat?channel=${metadata.channel_id}`;
      }
      return `/workspace/${workspaceId}/chat`;
    case 'workspace':
      return `/workspace/${workspaceId}`;
    default:
      return `/workspace/${workspaceId}`;
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !currentWorkspace?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(id, email, full_name, avatar_url)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data as Notification[] || []);
      setUnreadCount((data || []).filter((n: { is_read: boolean }) => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentWorkspace?.id]);

  // Fetch preferences (auto-create if missing)
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
        // Auto-create default preferences row
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

  // Mark single notification as read
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

  // Mark all as read
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

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const notification = notifications.find((n) => n.id === notificationId);

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Update preferences
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

      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to update preferences.',
        variant: 'destructive',
      });
    }
  }, [user?.id, currentWorkspace?.id, preferences, toast]);

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
            // Fetch the full notification with actor info
            const { data } = await supabase
              .from('notifications')
              .select(`
                *,
                actor:profiles!notifications_actor_id_fkey(id, email, full_name, avatar_url)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              setNotifications((prev) => [data as Notification, ...prev]);
              setUnreadCount((prev) => prev + 1);
              setHasNewNotification(true);

              // Reset animation trigger after a delay
              setTimeout(() => setHasNewNotification(false), 2000);

              // Show toast for new notification
              toast({
                title: data.title,
                description: data.body,
              });

              // Push notifications are now dispatched server-side
              // via the trigger_push_notification DB trigger + pg_net
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
                n.id === payload.new.id ? { ...n, ...payload.new } : n
              )
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== payload.old.id)
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
  }, [user?.id, currentWorkspace?.id, fetchNotifications, fetchPreferences, toast]);

  return {
    notifications,
    unreadCount,
    isLoading,
    preferences,
    hasNewNotification,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
  };
}

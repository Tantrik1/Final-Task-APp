import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  unread_count?: number;
}

export function useChat(workspaceId: string | undefined) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch channels with unread counts
  const fetchChannels = useCallback(async () => {
    if (!workspaceId || !user) return;

    try {
      const { data: channelData, error } = await supabase
        .from('channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get unread counts for each channel
      const channelsWithUnread = await Promise.all(
        (channelData || []).map(async (channel) => {
          const { data: countData } = await supabase
            .rpc('get_channel_unread_count', {
              p_channel_id: channel.id,
              p_user_id: user.id,
            });
          
          return {
            ...channel,
            unread_count: countData || 0,
          } as Channel;
        })
      );

      setChannels(channelsWithUnread);
      
      // Set first channel as active if none selected
      if (!activeChannel && channelsWithUnread.length > 0) {
        setActiveChannel(channelsWithUnread[0]);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, user, activeChannel]);

  // Create a new channel
  const createChannel = useCallback(async (name: string, description?: string) => {
    if (!workspaceId || !user) return null;

    try {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          workspace_id: workspaceId,
          name: name.toLowerCase().replace(/\s+/g, '-'),
          description: description || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Channel;
    } catch (error) {
      console.error('Error creating channel:', error);
      return null;
    }
  }, [workspaceId, user]);

  // Delete a channel
  const deleteChannel = useCallback(async (channelId: string) => {
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId);

      if (error) throw error;
      
      // If deleted channel was active, switch to first available
      if (activeChannel?.id === channelId) {
        const remaining = channels.filter(c => c.id !== channelId);
        setActiveChannel(remaining[0] || null);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting channel:', error);
      return false;
    }
  }, [activeChannel, channels]);

  // Mark channel as read
  const markChannelAsRead = useCallback(async (channelId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('channel_read_status')
        .upsert({
          channel_id: channelId,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        }, {
          onConflict: 'channel_id,user_id',
        });

      // Update local state
      setChannels(prev => 
        prev.map(c => 
          c.id === channelId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error('Error marking channel as read:', error);
    }
  }, [user]);

  // Get total unread count
  const totalUnreadCount = channels.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Initial fetch
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Subscribe to channel changes
  useEffect(() => {
    if (!workspaceId) return;

    const subscription = supabase
      .channel(`channels:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channels',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [workspaceId, fetchChannels]);

  // Subscribe to new messages for unread counts
  useEffect(() => {
    if (!workspaceId || channels.length === 0) return;

    const channelIds = channels.map(c => c.id);
    
    const subscription = supabase
      .channel(`unread:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as { channel_id: string; sender_id: string };
          
          // Update unread count if message is in one of our channels and not from current user
          if (channelIds.includes(newMessage.channel_id) && newMessage.sender_id !== user?.id) {
            // Only increment if not viewing that channel
            if (activeChannel?.id !== newMessage.channel_id) {
              setChannels(prev =>
                prev.map(c =>
                  c.id === newMessage.channel_id
                    ? { ...c, unread_count: (c.unread_count || 0) + 1 }
                    : c
                )
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [workspaceId, channels, activeChannel, user]);

  return {
    channels,
    activeChannel,
    setActiveChannel,
    isLoading,
    createChannel,
    deleteChannel,
    markChannelAsRead,
    totalUnreadCount,
    refetchChannels: fetchChannels,
  };
}

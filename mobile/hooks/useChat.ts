import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

    const fetchChannels = useCallback(async () => {
        if (!workspaceId || !user) return;

        try {
            const { data: channelData, error } = await supabase
                .from('channels')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: true });

            if (error) throw error;

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

            // Auto-select first channel only if none is active
            setActiveChannel(prev => {
                if (!prev && channelsWithUnread.length > 0) {
                    return channelsWithUnread[0];
                }
                return prev;
            });
        } catch (error) {
            console.error('Error fetching channels:', error);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, user]);

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

    const deleteChannel = useCallback(async (channelId: string) => {
        try {
            const { error } = await supabase
                .from('channels')
                .delete()
                .eq('id', channelId);

            if (error) throw error;

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

            setChannels(prev =>
                prev.map(c =>
                    c.id === channelId ? { ...c, unread_count: 0 } : (c as any)
                )
            );
        } catch (error) {
            console.error('Error marking channel as read:', error);
        }
    }, [user]);

    const totalUnreadCount = channels.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

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

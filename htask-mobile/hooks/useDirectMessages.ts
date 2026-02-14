import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface DMConversation {
    id: string;
    workspace_id: string;
    participant_1: string;
    participant_2: string;
    created_at: string;
    updated_at: string;
    other_user?: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
    };
    unread_count?: number;
    last_message?: {
        content: string;
        created_at: string;
        sender_id: string;
    } | null;
}

export function useDirectMessages(workspaceId: string | undefined) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<DMConversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<DMConversation | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConversations = useCallback(async () => {
        if (!workspaceId || !user) return;

        try {
            const { data, error } = await supabase
                .from('dm_conversations')
                .select('*')
                .eq('workspace_id', workspaceId)
                .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const conversationsWithDetails = await Promise.all(
                (data || []).map(async (conv: any) => {
                    const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('id, email, full_name, avatar_url')
                        .eq('id', otherUserId)
                        .single();

                    const { data: lastMsgData } = await supabase
                        .from('dm_messages')
                        .select('content, created_at, sender_id')
                        .eq('conversation_id', conv.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    const { data: unreadCount } = await supabase
                        .rpc('get_dm_unread_count', {
                            p_conversation_id: conv.id,
                            p_user_id: user.id,
                        });

                    return {
                        ...conv,
                        other_user: profileData,
                        last_message: lastMsgData || null,
                        unread_count: unreadCount || 0,
                    } as DMConversation;
                })
            );

            setConversations(conversationsWithDetails);
        } catch (error) {
            console.error('Error fetching DM conversations:', error);
        } finally {
            setIsLoading(false);
        }
    }, [workspaceId, user]);

    const startConversation = useCallback(async (otherUserId: string) => {
        if (!workspaceId || !user || otherUserId === user.id) return null;

        try {
            // Check if conversation already exists (both directions)
            const { data: existing } = await supabase
                .from('dm_conversations')
                .select('*')
                .eq('workspace_id', workspaceId)
                .or(`and(participant_1.eq.${user.id},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${user.id})`)
                .single();

            if (existing) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id, email, full_name, avatar_url')
                    .eq('id', otherUserId)
                    .single();

                const conv = {
                    ...existing,
                    other_user: profileData,
                    unread_count: 0,
                } as DMConversation;

                setActiveConversation(conv);
                return conv;
            }

            // Create new conversation
            const { data, error } = await supabase
                .from('dm_conversations')
                .insert({
                    workspace_id: workspaceId,
                    participant_1: user.id,
                    participant_2: otherUserId,
                })
                .select()
                .single();

            if (error) throw error;

            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, email, full_name, avatar_url')
                .eq('id', otherUserId)
                .single();

            const newConv = {
                ...data,
                other_user: profileData,
                unread_count: 0,
            } as DMConversation;

            setConversations(prev => [newConv, ...prev]);
            setActiveConversation(newConv);
            return newConv;
        } catch (error) {
            console.error('Error starting DM conversation:', error);
            return null;
        }
    }, [workspaceId, user]);

    const markAsRead = useCallback(async (conversationId: string) => {
        if (!user) return;

        try {
            await supabase
                .from('dm_read_status')
                .upsert({
                    conversation_id: conversationId,
                    user_id: user.id,
                    last_read_at: new Date().toISOString(),
                }, {
                    onConflict: 'conversation_id,user_id',
                });

            setConversations(prev =>
                prev.map(c =>
                    c.id === conversationId ? { ...c, unread_count: 0 } : c
                )
            );
        } catch (error) {
            console.error('Error marking DM as read:', error);
        }
    }, [user]);

    const totalUnreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Subscribe to conversation changes
    useEffect(() => {
        if (!workspaceId || !user) return;

        const subscription = supabase
            .channel(`dm_conversations:${workspaceId}:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'dm_conversations',
                    filter: `workspace_id=eq.${workspaceId}`,
                },
                () => {
                    fetchConversations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [workspaceId, user, fetchConversations]);

    // Subscribe to new DM messages for unread counts
    useEffect(() => {
        if (!workspaceId || conversations.length === 0 || !user) return;

        const conversationIds = conversations.map(c => c.id);

        const subscription = supabase
            .channel(`dm_messages_unread:${workspaceId}:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'dm_messages',
                },
                (payload) => {
                    const newMessage = payload.new as { conversation_id: string; sender_id: string; content: string; created_at: string };

                    if (conversationIds.includes(newMessage.conversation_id) && newMessage.sender_id !== user.id) {
                        if (activeConversation?.id !== newMessage.conversation_id) {
                            setConversations(prev =>
                                prev.map(c =>
                                    c.id === newMessage.conversation_id
                                        ? {
                                            ...c,
                                            unread_count: (c.unread_count || 0) + 1,
                                            last_message: {
                                                content: newMessage.content,
                                                created_at: newMessage.created_at,
                                                sender_id: newMessage.sender_id,
                                            },
                                        }
                                        : c
                                )
                            );
                        } else {
                            setConversations(prev =>
                                prev.map(c =>
                                    c.id === newMessage.conversation_id
                                        ? {
                                            ...c,
                                            last_message: {
                                                content: newMessage.content,
                                                created_at: newMessage.created_at,
                                                sender_id: newMessage.sender_id,
                                            },
                                        }
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
    }, [workspaceId, conversations, activeConversation, user]);

    return {
        conversations,
        activeConversation,
        setActiveConversation,
        isLoading,
        startConversation,
        markAsRead,
        totalUnreadCount,
        refetchConversations: fetchConversations,
    };
}

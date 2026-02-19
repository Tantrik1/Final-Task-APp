import { useState, useEffect, useCallback, useRef } from 'react';
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
            // Use optimized RPC - single query instead of N+1
            const { data, error } = await supabase.rpc('get_dm_conversations_optimized', {
                p_workspace_id: workspaceId,
                p_user_id: user.id,
            });

            if (error) throw error;

            // Map RPC result to DMConversation format
            const conversationsWithDetails = (data || []).map((row: any) => ({
                id: row.id,
                workspace_id: row.workspace_id,
                participant_1: row.participant_1,
                participant_2: row.participant_2,
                created_at: row.created_at,
                updated_at: row.updated_at,
                other_user: {
                    id: row.other_user_id,
                    email: row.other_user_email,
                    full_name: row.other_user_full_name,
                    avatar_url: row.other_user_avatar_url,
                },
                last_message: row.last_message_content ? {
                    content: row.last_message_content,
                    created_at: row.last_message_created_at,
                    sender_id: row.last_message_sender_id,
                } : null,
                unread_count: row.unread_count,
            }));

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

    // Use refs to avoid re-subscribing on every state change
    const activeConvRef = useRef(activeConversation);
    useEffect(() => { activeConvRef.current = activeConversation; }, [activeConversation]);

    // Subscribe to new DM messages for unread counts
    useEffect(() => {
        if (!workspaceId || !user) return;

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
                    if (newMessage.sender_id === user.id) return;

                    const isActiveConv = activeConvRef.current?.id === newMessage.conversation_id;
                    setConversations(prev => {
                        // Check if this conversation belongs to us
                        if (!prev.some(c => c.id === newMessage.conversation_id)) return prev;
                        return prev.map(c =>
                            c.id === newMessage.conversation_id
                                ? {
                                    ...c,
                                    unread_count: isActiveConv ? c.unread_count : (c.unread_count || 0) + 1,
                                    last_message: {
                                        content: newMessage.content,
                                        created_at: newMessage.created_at,
                                        sender_id: newMessage.sender_id,
                                    },
                                }
                                : c
                        );
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [workspaceId, user]);

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

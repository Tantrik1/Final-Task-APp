import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface DMMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    is_edited: boolean;
    edited_at: string | null;
    created_at: string;
    sender?: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
}

const MESSAGES_PER_PAGE = 50;

export function useDMMessages(conversationId: string | undefined) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<DMMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const fetchMessages = useCallback(async (before?: string) => {
        if (!conversationId) return;

        try {
            let query = supabase
                .from('dm_messages')
                .select(`
                    *,
                    sender:profiles!dm_messages_sender_id_fkey(id, email, full_name, avatar_url)
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(MESSAGES_PER_PAGE);

            if (before) {
                query = query.lt('created_at', before);
            }

            const { data, error } = await query;
            if (error) throw error;

            const messagesWithSender = (data || []).map((msg: any) => ({
                ...msg,
                sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
            } as DMMessage));

            const orderedMessages = messagesWithSender.reverse();

            if (before) {
                setMessages(prev => [...orderedMessages, ...prev]);
            } else {
                setMessages(orderedMessages);
            }

            setHasMore(messagesWithSender.length === MESSAGES_PER_PAGE);
        } catch (error) {
            console.error('[useDMMessages] Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [conversationId]);

    const loadMore = useCallback(() => {
        if (messages.length > 0 && hasMore) {
            fetchMessages(messages[0].created_at);
        }
    }, [messages, hasMore, fetchMessages]);

    const sendMessage = useCallback(async (content: string) => {
        if (!conversationId || !user || !content.trim() || isSending) return false;

        setIsSending(true);
        const tempId = `temp-${Date.now()}`;
        const tempMessage: DMMessage = {
            id: tempId,
            conversation_id: conversationId,
            sender_id: user.id,
            content: content.trim(),
            is_edited: false,
            edited_at: null,
            created_at: new Date().toISOString(),
            sender: {
                id: user.id,
                email: user.email || '',
                full_name: null,
                avatar_url: null,
            },
        };

        // Optimistic update
        setMessages(prev => [...prev, tempMessage]);

        try {
            const { data, error } = await supabase
                .from('dm_messages')
                .insert({
                    conversation_id: conversationId,
                    sender_id: user.id,
                    content: content.trim(),
                })
                .select(`
                    *,
                    sender:profiles!dm_messages_sender_id_fkey(id, email, full_name, avatar_url)
                `)
                .single();

            if (error) throw error;

            // Replace temp message with real one
            setMessages(prev =>
                prev.map(m =>
                    m.id === tempId
                        ? {
                            ...data,
                            sender: Array.isArray(data.sender) ? data.sender[0] : data.sender,
                        } as DMMessage
                        : m
                )
            );

            // Update conversation's updated_at
            await supabase
                .from('dm_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);

            return true;
        } catch (error) {
            console.error('[useDMMessages] Send error:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            return false;
        } finally {
            setIsSending(false);
        }
    }, [conversationId, user, isSending]);

    const editMessage = useCallback(async (messageId: string, newContent: string) => {
        if (!user) return false;

        try {
            const { error } = await supabase
                .from('dm_messages')
                .update({
                    content: newContent.trim(),
                    is_edited: true,
                    edited_at: new Date().toISOString(),
                })
                .eq('id', messageId)
                .eq('sender_id', user.id);

            if (error) throw error;

            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, content: newContent.trim(), is_edited: true, edited_at: new Date().toISOString() }
                        : m
                )
            );
            return true;
        } catch (error) {
            console.error('[useDMMessages] Edit error:', error);
            return false;
        }
    }, [user]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!user) return false;

        try {
            const { error } = await supabase
                .from('dm_messages')
                .delete()
                .eq('id', messageId)
                .eq('sender_id', user.id);

            if (error) throw error;
            setMessages(prev => prev.filter(m => m.id !== messageId));
            return true;
        } catch (error) {
            console.error('[useDMMessages] Delete error:', error);
            return false;
        }
    }, [user]);

    // Reset and fetch on conversation change
    useEffect(() => {
        setIsLoading(true);
        setMessages([]);
        setHasMore(true);
        fetchMessages();
    }, [conversationId, fetchMessages]);

    // Subscribe to realtime changes
    useEffect(() => {
        if (!conversationId) return;

        const subscription = supabase
            .channel(`dm_messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'dm_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                async (payload) => {
                    const newMsg = payload.new as any;
                    if (newMsg.sender_id === user?.id) return;

                    const { data } = await supabase
                        .from('dm_messages')
                        .select(`
                            *,
                            sender:profiles!dm_messages_sender_id_fkey(id, email, full_name, avatar_url)
                        `)
                        .eq('id', newMsg.id)
                        .single();

                    if (data) {
                        setMessages(prev => [
                            ...prev,
                            {
                                ...data,
                                sender: Array.isArray(data.sender) ? data.sender[0] : data.sender,
                            } as DMMessage,
                        ]);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'dm_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const updated = payload.new as any;
                    setMessages(prev =>
                        prev.map(m =>
                            m.id === updated.id
                                ? { ...m, content: updated.content, is_edited: updated.is_edited, edited_at: updated.edited_at }
                                : m
                        )
                    );
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'dm_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const deleted = payload.old as any;
                    setMessages(prev => prev.filter(m => m.id !== deleted.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [conversationId, user]);

    return {
        messages,
        isLoading,
        isSending,
        hasMore,
        loadMore,
        sendMessage,
        editMessage,
        deleteMessage,
    };
}

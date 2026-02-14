import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MessageSender {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  sender?: MessageSender | null;
  reply_to?: {
    id: string;
    content: string;
    sender?: MessageSender | null;
  } | null;
}

const MESSAGES_PER_PAGE = 50;

export function useChatMessages(channelId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = useCallback(async (before?: string) => {
    if (!channelId) return;

    try {
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, email, full_name, avatar_url)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch reply_to data for messages that have replies
      const messagesWithReplies = await Promise.all(
        (data || []).map(async (msg: any) => {
          let replyTo = null;
          
          if (msg.reply_to_id) {
            const { data: replyData } = await supabase
              .from('messages')
              .select(`
                id, content,
                sender:profiles!messages_sender_id_fkey(id, email, full_name, avatar_url)
              `)
              .eq('id', msg.reply_to_id)
              .single();
            
            if (replyData) {
              replyTo = {
                ...replyData,
                sender: Array.isArray(replyData.sender) ? replyData.sender[0] : replyData.sender,
              };
            }
          }

          return {
            ...msg,
            sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
            reply_to: replyTo,
          } as Message;
        })
      );

      // Reverse to show oldest first
      const orderedMessages = messagesWithReplies.reverse();

      if (before) {
        setMessages(prev => [...orderedMessages, ...prev]);
      } else {
        setMessages(orderedMessages);
      }

      setHasMore(messagesWithReplies.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  // Load more (older) messages
  const loadMore = useCallback(() => {
    if (messages.length > 0 && hasMore) {
      fetchMessages(messages[0].created_at);
    }
  }, [messages, hasMore, fetchMessages]);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!channelId || !user || !content.trim() || isSending) return false;

    setIsSending(true);
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      channel_id: channelId,
      sender_id: user.id,
      content: content.trim(),
      reply_to_id: replyingTo?.id || null,
      is_edited: false,
      edited_at: null,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        email: user.email || '',
        full_name: null,
        avatar_url: null,
      },
      reply_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        sender: replyingTo.sender,
      } : null,
    };

    // Optimistic update
    setMessages(prev => [...prev, tempMessage]);
    setReplyingTo(null);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          content: content.trim(),
          reply_to_id: replyingTo?.id || null,
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, email, full_name, avatar_url)
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
                reply_to: tempMessage.reply_to,
              } as Message
            : m
        )
      );

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      return false;
    } finally {
      setIsSending(false);
    }
  }, [channelId, user, isSending, replyingTo]);

  // Edit a message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('messages')
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
      console.error('Error editing message:', error);
      return false;
    }
  }, [user]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== messageId));
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    setMessages([]);
    setReplyingTo(null);
    fetchMessages();
  }, [channelId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!channelId) return;

    const subscription = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Skip if it's our own message (already added optimistically)
          if (newMsg.sender_id === user?.id) return;

          // Fetch full message with sender info
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              sender:profiles!messages_sender_id_fkey(id, email, full_name, avatar_url)
            `)
            .eq('id', newMsg.id)
            .single();

          if (data) {
            let replyTo = null;
            if (data.reply_to_id) {
              const { data: replyData } = await supabase
                .from('messages')
                .select(`
                  id, content,
                  sender:profiles!messages_sender_id_fkey(id, email, full_name, avatar_url)
                `)
                .eq('id', data.reply_to_id)
                .single();
              
              if (replyData) {
                replyTo = {
                  ...replyData,
                  sender: Array.isArray(replyData.sender) ? replyData.sender[0] : replyData.sender,
                };
              }
            }

            setMessages(prev => [
              ...prev,
              {
                ...data,
                sender: Array.isArray(data.sender) ? data.sender[0] : data.sender,
                reply_to: replyTo,
              } as Message,
            ]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
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
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
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
  }, [channelId, user]);

  return {
    messages,
    isLoading,
    isSending,
    hasMore,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    replyingTo,
    setReplyingTo,
    lastMessageRef,
  };
}

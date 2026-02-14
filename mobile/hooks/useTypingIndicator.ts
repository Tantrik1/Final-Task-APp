import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface TypingUser {
    user_id: string;
    name: string;
}

export function useTypingIndicator(channelOrConversationId: string | undefined) {
    const { user } = useAuth();
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);
    const stopTypingRef = useRef<() => void>(() => { });

    const startTyping = useCallback(async () => {
        if (!channelOrConversationId || !user || isTypingRef.current) return;

        isTypingRef.current = true;

        if (channelRef.current) {
            await channelRef.current.track({
                user_id: user.id,
                name: user.email?.split('@')[0] || 'User',
                typing: true,
            });
        }

        // Auto-stop typing after 3 seconds of no input
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            stopTypingRef.current();
        }, 3000);
    }, [channelOrConversationId, user]);

    const stopTyping = useCallback(async () => {
        if (!channelOrConversationId || !user) return;

        isTypingRef.current = false;

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        if (channelRef.current) {
            await channelRef.current.track({
                user_id: user.id,
                name: user.email?.split('@')[0] || 'User',
                typing: false,
            });
        }
    }, [channelOrConversationId, user]);

    // Keep the ref in sync so startTyping's setTimeout always calls the latest version
    useEffect(() => {
        stopTypingRef.current = stopTyping;
    }, [stopTyping]);

    useEffect(() => {
        if (!channelOrConversationId || !user) return;

        const channel = supabase.channel(`typing:${channelOrConversationId}`, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const users: TypingUser[] = [];

                Object.values(state).forEach((presences: any[]) => {
                    presences.forEach((presence) => {
                        if (presence.typing && presence.user_id !== user.id) {
                            users.push({
                                user_id: presence.user_id,
                                name: presence.name,
                            });
                        }
                    });
                });

                setTypingUsers(users);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        name: user.email?.split('@')[0] || 'User',
                        typing: false,
                    });
                }
            });

        channelRef.current = channel;

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [channelOrConversationId, user]);

    // Format typing text
    const typingText = typingUsers.length === 0
        ? null
        : typingUsers.length === 1
            ? `${typingUsers[0].name} is typing...`
            : typingUsers.length === 2
                ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`
                : `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`;

    return {
        typingUsers,
        typingText,
        startTyping,
        stopTyping,
        isTyping: isTypingRef.current,
    };
}

import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface OnlineUser {
    user_id: string;
    email: string;
    name: string;
    online_at: string;
}

export function useOnlinePresence(workspaceId: string | undefined) {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        if (!workspaceId || !user) return;

        const channel = supabase.channel(`presence:${workspaceId}`, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const users: OnlineUser[] = [];

                Object.values(state).forEach((presences: any[]) => {
                    presences.forEach((presence) => {
                        users.push({
                            user_id: presence.user_id,
                            email: presence.email,
                            name: presence.name,
                            online_at: presence.online_at,
                        });
                    });
                });

                setOnlineUsers(users);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        email: user.email || '',
                        name: user.email?.split('@')[0] || 'User',
                        online_at: new Date().toISOString(),
                    });
                }
            });

        channelRef.current = channel;

        // Update presence every 30 seconds to keep connection alive
        const intervalId = setInterval(async () => {
            if (channelRef.current) {
                await channelRef.current.track({
                    user_id: user.id,
                    email: user.email || '',
                    name: user.email?.split('@')[0] || 'User',
                    online_at: new Date().toISOString(),
                });
            }
        }, 30000);

        // Handle app state changes (background/foreground)
        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState === 'active' && channelRef.current) {
                channelRef.current.track({
                    user_id: user.id,
                    email: user.email || '',
                    name: user.email?.split('@')[0] || 'User',
                    online_at: new Date().toISOString(),
                });
            }
        };

        const appSub = AppState.addEventListener('change', handleAppState);

        return () => {
            clearInterval(intervalId);
            appSub.remove();
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [workspaceId, user]);

    const isUserOnline = (userId: string) => {
        return onlineUsers.some(u => u.user_id === userId);
    };

    return {
        onlineUsers,
        onlineCount: onlineUsers.length,
        isUserOnline,
    };
}

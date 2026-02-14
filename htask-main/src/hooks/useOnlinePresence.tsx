import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
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

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [workspaceId, user]);

  // Check if a specific user is online
  const isUserOnline = (userId: string) => {
    return onlineUsers.some(u => u.user_id === userId);
  };

  return {
    onlineUsers,
    onlineCount: onlineUsers.length,
    isUserOnline,
  };
}

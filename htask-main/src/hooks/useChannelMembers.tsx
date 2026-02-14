import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  added_by: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export function useChannelMembers(channelId: string | undefined) {
  const { user } = useAuth();
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!channelId) return;

    try {
      const { data, error } = await supabase
        .from('channel_members')
        .select(`
          *,
          profile:profiles!channel_members_user_id_fkey (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('channel_id', channelId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      const membersData = (data || []).map(m => ({
        ...m,
        role: m.role as 'admin' | 'member',
        profile: m.profile as ChannelMember['profile'],
      }));

      setMembers(membersData);

      // Set current user's role
      const currentMember = membersData.find(m => m.user_id === user?.id);
      setCurrentUserRole(currentMember?.role || null);
    } catch (error) {
      console.error('Error fetching channel members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, user?.id]);

  // Add member to channel
  const addMember = useCallback(async (userId: string, role: 'admin' | 'member' = 'member') => {
    if (!channelId || !user) return false;

    try {
      const { error } = await supabase
        .from('channel_members')
        .insert({
          channel_id: channelId,
          user_id: userId,
          role,
          added_by: user.id,
        });

      if (error) throw error;
      await fetchMembers();
      return true;
    } catch (error) {
      console.error('Error adding channel member:', error);
      return false;
    }
  }, [channelId, user, fetchMembers]);

  // Remove member from channel
  const removeMember = useCallback(async (userId: string) => {
    if (!channelId) return false;

    try {
      const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;
      await fetchMembers();
      return true;
    } catch (error) {
      console.error('Error removing channel member:', error);
      return false;
    }
  }, [channelId, fetchMembers]);

  // Update member role
  const updateMemberRole = useCallback(async (userId: string, newRole: 'admin' | 'member') => {
    if (!channelId) return false;

    try {
      const { error } = await supabase
        .from('channel_members')
        .update({ role: newRole })
        .eq('channel_id', channelId)
        .eq('user_id', userId);

      if (error) throw error;
      await fetchMembers();
      return true;
    } catch (error) {
      console.error('Error updating member role:', error);
      return false;
    }
  }, [channelId, fetchMembers]);

  // Initial fetch
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Subscribe to changes
  useEffect(() => {
    if (!channelId) return;

    const subscription = supabase
      .channel(`channel_members:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_members',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [channelId, fetchMembers]);

  const isAdmin = currentUserRole === 'admin';
  const memberCount = members.length;
  const adminCount = members.filter(m => m.role === 'admin').length;

  return {
    members,
    isLoading,
    currentUserRole,
    isAdmin,
    memberCount,
    adminCount,
    addMember,
    removeMember,
    updateMemberRole,
    refetch: fetchMembers,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';

export interface PendingInvitation {
    id: string;
    workspace_id: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
    expires_at: string;
    invited_by: string;
    workspace_name: string;
    workspace_description: string | null;
    workspace_logo_url: string | null;
    inviter_name: string;
    inviter_email: string;
}

export function usePendingInvitations() {
    const { user } = useAuth();
    const { refreshWorkspaces } = useWorkspace();
    const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchInvitations = useCallback(async () => {
        if (!user?.email) {
            setInvitations([]);
            setIsLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('workspace_invitations')
                .select(`
                    id,
                    workspace_id,
                    email,
                    role,
                    status,
                    created_at,
                    expires_at,
                    invited_by,
                    workspaces (
                        name,
                        description,
                        logo_url
                    )
                `)
                .ilike('email', user.email)
                .eq('status', 'pending')
                .gt('expires_at', new Date().toISOString());

            if (error) {
                console.error('Error fetching invitations:', error);
                setInvitations([]);
                setIsLoading(false);
                return;
            }

            // Fetch inviter profiles separately
            const inviterIds = [...new Set((data || []).map((inv: any) => inv.invited_by))];
            let inviterMap: Record<string, { full_name: string; email: string }> = {};

            if (inviterIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', inviterIds);

                if (profiles) {
                    inviterMap = Object.fromEntries(
                        profiles.map((p: any) => [p.id, { full_name: p.full_name || p.email.split('@')[0], email: p.email }])
                    );
                }
            }

            const mapped: PendingInvitation[] = (data || [])
                .filter((inv: any) => inv.workspaces)
                .map((inv: any) => ({
                    id: inv.id,
                    workspace_id: inv.workspace_id,
                    email: inv.email,
                    role: inv.role,
                    status: inv.status,
                    created_at: inv.created_at,
                    expires_at: inv.expires_at,
                    invited_by: inv.invited_by,
                    workspace_name: inv.workspaces.name,
                    workspace_description: inv.workspaces.description,
                    workspace_logo_url: inv.workspaces.logo_url,
                    inviter_name: inviterMap[inv.invited_by]?.full_name || 'Someone',
                    inviter_email: inviterMap[inv.invited_by]?.email || '',
                }));

            setInvitations(mapped);
        } catch (error) {
            console.error('Error fetching invitations:', error);
            setInvitations([]);
        } finally {
            setIsLoading(false);
        }
    }, [user?.email]);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations]);

    // Realtime subscription
    useEffect(() => {
        if (!user?.email) return;

        const channel = supabase
            .channel('pending-invitations')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'workspace_invitations',
                    filter: `email=eq.${user.email}`,
                },
                () => {
                    fetchInvitations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.email, fetchInvitations]);

    const acceptInvitation = useCallback(async (invitation: PendingInvitation) => {
        if (!user) throw new Error('Not authenticated');

        // INV-01: Re-validate expiry server-side before accepting (screen may have been open past expiry)
        if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
            throw new Error('This invitation has expired. Please ask the workspace admin to send a new one.');
        }

        // Insert into workspace_members
        const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
                workspace_id: invitation.workspace_id,
                user_id: user.id,
                role: invitation.role,
                invited_by: invitation.invited_by,
            });

        if (memberError) {
            // Unique constraint = already a member
            if (memberError.code !== '23505') {
                throw memberError;
            }
        }

        // Update invitation status
        await supabase
            .from('workspace_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitation.id);

        // Remove from local state
        setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

        // Refresh workspaces so the new one appears
        await refreshWorkspaces();
    }, [user, refreshWorkspaces]);

    const declineInvitation = useCallback(async (invitation: PendingInvitation) => {
        // Update invitation status
        await supabase
            .from('workspace_invitations')
            .update({ status: 'declined' })
            .eq('id', invitation.id);

        // Remove from local state
        setInvitations(prev => prev.filter(inv => inv.id !== invitation.id));

        // INV-02: Refresh workspaces in case state needs updating
        await refreshWorkspaces();
    }, [refreshWorkspaces]);

    return {
        invitations,
        isLoading,
        acceptInvitation,
        declineInvitation,
        refetch: fetchInvitations,
    };
}

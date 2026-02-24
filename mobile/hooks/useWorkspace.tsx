import { useState, useEffect, createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types matching webapp structure
export type Workspace = {
    id: string;
    created_at: string;
    name: string;
    logo_url: string | null;
    description: string | null;
    created_by: string | null;
    updated_at: string | null;
};

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface WorkspaceWithRole extends Workspace {
    role: WorkspaceRole;
}

interface WorkspaceContextType {
    workspaces: WorkspaceWithRole[];
    currentWorkspace: WorkspaceWithRole | null;
    currentRole: WorkspaceRole | null;
    isLoading: boolean;
    setCurrentWorkspaceId: (id: string) => void;
    refreshWorkspaces: () => Promise<void>;
    createWorkspace: (name: string, description?: string) => Promise<{ data: Workspace | null; error: Error | null }>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY = 'currentWorkspaceId';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchWorkspaces = useCallback(async () => {
        if (!user) {
            setWorkspaces([]);
            setIsLoading(false);
            return;
        }

        try {
            // Fetch workspace memberships with workspace details
            const { data: memberships, error: membershipError } = await supabase
                .from('workspace_members')
                .select(`
                    role,
                    workspace_id,
                    workspaces (*)
                `)
                .eq('user_id', user.id);

            if (membershipError) throw membershipError;

            const workspacesWithRoles: WorkspaceWithRole[] = (memberships || [])
                .filter((m: any) => m.workspaces)
                .map((m: any) => ({
                    ...m.workspaces,
                    role: m.role,
                }));

            setWorkspaces(workspacesWithRoles);

            // Set current workspace from AsyncStorage or first available
            const storedId = await AsyncStorage.getItem(STORAGE_KEY);
            if (storedId && workspacesWithRoles.some((w) => w.id === storedId)) {
                setCurrentWorkspaceId(storedId);
            } else if (workspacesWithRoles.length > 0) {
                setCurrentWorkspaceId(workspacesWithRoles[0].id);
            }
        } catch (error) {
            console.error('Error fetching workspaces:', error);
        } finally {
            setIsLoading(false);
        }
        // MW-02: depend on user.id (stable primitive) not user object (new ref on every auth event)
    }, [user?.id]);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    // MW-03: Realtime subscription for remote role changes.
    // If another admin changes the current user's role in any workspace,
    // re-fetch memberships so currentRole reflects the updated value immediately.
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel(`my-memberships-rt-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'workspace_members',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    fetchWorkspaces();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchWorkspaces]);

    useEffect(() => {
        if (currentWorkspaceId) {
            AsyncStorage.setItem(STORAGE_KEY, currentWorkspaceId);
        }
    }, [currentWorkspaceId]);

    const createWorkspace = useCallback(
        async (name: string, description?: string) => {
            if (!user) return { data: null, error: new Error('Not authenticated') };

            try {
                // WS-01: Use atomic RPC — creates workspace + owner membership in one transaction.
                // Previously two separate inserts created a race window where the workspace
                // existed without an owner row, making it inaccessible (RLS blocks reads).
                const { data: result, error: rpcError } = await supabase
                    .rpc('create_workspace_with_owner', {
                        p_name: name,
                        p_description: description || null,
                        p_user_id: user.id,
                    });

                if (rpcError) throw rpcError;

                const workspace = result as Workspace;

                // Refresh workspaces list (done after RPC so both rows exist)
                await fetchWorkspaces();

                return { data: workspace, error: null };
            } catch (error) {
                return { data: null, error: error as Error };
            }
        },
        [user?.id, fetchWorkspaces]
    );

    const currentWorkspace = useMemo(() => workspaces.find((w) => w.id === currentWorkspaceId) || null, [workspaces, currentWorkspaceId]);
    const currentRole = useMemo(() => currentWorkspace?.role || null, [currentWorkspace]);

    const value = useMemo(() => ({
        workspaces,
        currentWorkspace,
        currentRole,
        isLoading,
        setCurrentWorkspaceId,
        refreshWorkspaces: fetchWorkspaces,
        createWorkspace,
    }), [workspaces, currentWorkspace, currentRole, isLoading, fetchWorkspaces, createWorkspace]);

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}

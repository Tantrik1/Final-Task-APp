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
    }, [user]);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    useEffect(() => {
        if (currentWorkspaceId) {
            AsyncStorage.setItem(STORAGE_KEY, currentWorkspaceId);
        }
    }, [currentWorkspaceId]);

    const createWorkspace = useCallback(
        async (name: string, description?: string) => {
            if (!user) return { data: null, error: new Error('Not authenticated') };

            try {
                // Create workspace
                const { data: workspace, error: workspaceError } = await supabase
                    .from('workspaces')
                    .insert({
                        name,
                        description,
                        created_by: user.id,
                    } as any)
                    .select()
                    .single();

                if (workspaceError) throw workspaceError;

                // Add user as owner
                const { error: memberError } = await supabase.from('workspace_members').insert({
                    workspace_id: workspace.id,
                    user_id: user.id,
                    role: 'owner',
                });

                if (memberError) throw memberError;

                // Refresh workspaces
                await fetchWorkspaces();

                return { data: workspace, error: null };
            } catch (error) {
                return { data: null, error: error as Error };
            }
        },
        [user, fetchWorkspaces]
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

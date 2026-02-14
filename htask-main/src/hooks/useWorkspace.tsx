import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Database } from '@/integrations/supabase/types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];
type WorkspaceRole = Database['public']['Enums']['workspace_role'];

interface WorkspaceWithRole extends Workspace {
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
        .filter((m) => m.workspaces)
        .map((m) => ({
          ...(m.workspaces as Workspace),
          role: m.role,
        }));

      setWorkspaces(workspacesWithRoles);

      // Set current workspace from localStorage or first available
      const storedId = localStorage.getItem('currentWorkspaceId');
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
      localStorage.setItem('currentWorkspaceId', currentWorkspaceId);
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
          })
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

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || null;
  const currentRole = currentWorkspace?.role || null;

  const value = {
    workspaces,
    currentWorkspace,
    currentRole,
    isLoading,
    setCurrentWorkspaceId,
    refreshWorkspaces: fetchWorkspaces,
    createWorkspace,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

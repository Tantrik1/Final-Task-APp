import { useEffect, useState } from 'react';
import { Search, MoreHorizontal, Users, FolderKanban, Eye, Ban, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { WorkspaceDetailDialog } from '@/components/admin/WorkspaceDetailDialog';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  project_count: number;
  plan_id: string;
  plan_name: string;
  subscription_status: string;
  subscription_expires_at: string | null;
  owner_email: string;
}

export default function AdminWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [plans, setPlans] = useState<{ id: string; name: string; price_npr: number }[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchWorkspaces();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('id, name, price_npr')
      .order('position');
    if (data) setPlans(data);
  };

  const fetchWorkspaces = async () => {
    try {
      // Get workspaces with subscriptions
      const { data: workspacesData, error } = await supabase
        .from('workspaces')
        .select(`
          id,
          name,
          created_at,
          created_by,
          subscription:workspace_subscriptions(
            status,
            member_count,
            expires_at,
            plan_id,
            plan:subscription_plans(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get project counts
      const workspaceIds = workspacesData?.map((w) => w.id) ?? [];
      const { data: projectCounts } = await supabase
        .from('projects')
        .select('workspace_id')
        .in('workspace_id', workspaceIds)
        .eq('is_archived', false);

      const projectCountMap: Record<string, number> = {};
      projectCounts?.forEach((p) => {
        projectCountMap[p.workspace_id] = (projectCountMap[p.workspace_id] ?? 0) + 1;
      });

      // Get owner emails
      const creatorIds = [...new Set(workspacesData?.map((w) => w.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', creatorIds);

      const emailMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        emailMap[p.id] = p.email;
      });

      const transformed: Workspace[] =
        workspacesData?.map((w) => {
          const sub = (w.subscription as any)?.[0];
          return {
            id: w.id,
            name: w.name,
            created_at: w.created_at,
            member_count: sub?.member_count ?? 1,
            project_count: projectCountMap[w.id] ?? 0,
            plan_id: sub?.plan_id ?? '',
            plan_name: sub?.plan?.name ?? 'Free',
            subscription_status: sub?.status ?? 'active',
            subscription_expires_at: sub?.expires_at ?? null,
            owner_email: emailMap[w.created_by] ?? 'Unknown',
          };
        }) ?? [];

      setWorkspaces(transformed);
    } catch (err) {
      console.error('Error fetching workspaces:', err);
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setDetailDialogOpen(true);
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceToDelete.id);

      if (error) throw error;
      toast.success('Workspace deleted');
      fetchWorkspaces();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete workspace');
    } finally {
      setDeleteDialogOpen(false);
      setWorkspaceToDelete(null);
    }
  };

  const filteredWorkspaces = workspaces.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.owner_email.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = planFilter === 'all' || w.plan_name === planFilter;
    return matchesSearch && matchesPlan;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>;
      case 'trial':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Trial</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Expired</Badge>;
      case 'grace_period':
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Grace Period</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <p className="text-muted-foreground">Manage all customer workspaces</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or owner email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.name}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{workspaces.length}</div>
            <p className="text-xs text-muted-foreground">Total Workspaces</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {workspaces.filter((w) => w.subscription_status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {workspaces.filter((w) => w.subscription_status === 'trial').length}
            </div>
            <p className="text-xs text-muted-foreground">On Trial</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {workspaces.filter((w) => w.subscription_status === 'expired').length}
            </div>
            <p className="text-xs text-muted-foreground">Expired</p>
          </CardContent>
        </Card>
      </div>

      {/* Workspaces List */}
      <Card>
        <CardHeader>
          <CardTitle>All Workspaces ({filteredWorkspaces.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredWorkspaces.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No workspaces found
              </div>
            ) : (
              filteredWorkspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{workspace.name}</h3>
                      {getStatusBadge(workspace.subscription_status)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{workspace.owner_email}</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {workspace.member_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {workspace.project_count}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <Badge variant="outline">{workspace.plan_name}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(workspace.created_at), { addSuffix: true })}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(workspace)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewDetails(workspace)}>
                          <Users className="h-4 w-4 mr-2" />
                          Manage Subscription
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setWorkspaceToDelete(workspace);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Detail Dialog */}
      <WorkspaceDetailDialog
        workspace={selectedWorkspace ? {
          id: selectedWorkspace.id,
          name: selectedWorkspace.name,
          created_at: selectedWorkspace.created_at,
          owner_email: selectedWorkspace.owner_email,
          member_count: selectedWorkspace.member_count,
          project_count: selectedWorkspace.project_count,
          subscription: {
            plan_id: selectedWorkspace.plan_id,
            plan_name: selectedWorkspace.plan_name,
            status: selectedWorkspace.subscription_status,
            starts_at: selectedWorkspace.created_at,
            expires_at: selectedWorkspace.subscription_expires_at,
          }
        } : null}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        plans={plans}
        onRefresh={fetchWorkspaces}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workspaceToDelete?.name}"? This will permanently 
              delete all projects, tasks, and data associated with this workspace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkspace} className="bg-destructive text-destructive-foreground">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

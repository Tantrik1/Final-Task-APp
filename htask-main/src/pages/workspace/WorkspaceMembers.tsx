import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { 
  Plus, Users, MoreHorizontal, Crown, Shield, User, Eye, 
  Trash2, Lock, Sparkles, Clock, UserCheck, Send, Search,
  Settings, UserMinus, ChevronRight
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { UpgradeDialog } from '@/components/subscription/UpgradeDialog';
import { InviteMemberDialog, InviteFormData } from '@/components/workspace/InviteMemberDialog';
import { ManageMemberDialog } from '@/components/workspace/ManageMemberDialog';
import { MemberDetailSheet } from '@/components/workspace/MemberDetailSheet';
import { formatDistanceToNow } from 'date-fns';

type WorkspaceRole = Database['public']['Enums']['workspace_role'];

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
  last_active_at: string | null;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    needs_password_reset: boolean | null;
  };
}

const roleIcons: Record<WorkspaceRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

const roleColors: Record<WorkspaceRole, string> = {
  owner: 'bg-role-owner/10 text-role-owner border-role-owner/20',
  admin: 'bg-role-admin/10 text-role-admin border-role-admin/20',
  member: 'bg-role-member/10 text-role-member border-role-member/20',
  viewer: 'bg-role-viewer/10 text-role-viewer border-role-viewer/20',
};

type TabValue = 'all' | 'active' | 'awaiting-login' | 'inactive';

export default function WorkspaceMembers() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentRole, currentWorkspace } = useWorkspace();
  const { canAddMember, memberLimit, memberCount, subscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberWithProfile | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resendingFor, setResendingFor] = useState<string | null>(null);
  const [memberToManage, setMemberToManage] = useState<MemberWithProfile | null>(null);
  const [memberToView, setMemberToView] = useState<MemberWithProfile | null>(null);

  const canManageMembers = currentRole === 'owner' || currentRole === 'admin';

  const fetchMembers = async () => {
    if (!workspaceId) return;

    try {
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          last_active_at,
          profiles!workspace_members_user_id_fkey (
            id,
            email,
            full_name,
            avatar_url,
            needs_password_reset
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData as unknown as MemberWithProfile[]);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  // Helper to check if member is active (last 7 days)
  const isActiveMember = (member: MemberWithProfile): boolean => {
    if (!member.last_active_at) return false;
    const lastActive = new Date(member.last_active_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastActive > sevenDaysAgo;
  };

  // Helper to check if member is inactive (30+ days)
  const isInactiveMember = (member: MemberWithProfile): boolean => {
    // Not inactive if awaiting login
    if (member.profiles.needs_password_reset === true) return false;
    
    if (!member.last_active_at) return true; // Never logged in and not awaiting setup
    const lastActive = new Date(member.last_active_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastActive < thirtyDaysAgo;
  };

  // Get member status for visual indicator
  const getMemberStatus = (member: MemberWithProfile): 'active' | 'awaiting' | 'inactive' => {
    if (member.profiles.needs_password_reset === true) return 'awaiting';
    if (isActiveMember(member)) return 'active';
    return 'inactive';
  };

  // Filtered data based on active tab and search
  const filteredData = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    
    const filteredMembers = members.filter(m => {
      const matchesSearch = !searchQuery || 
        m.profiles.email.toLowerCase().includes(searchLower) ||
        (m.profiles.full_name?.toLowerCase().includes(searchLower) ?? false);
      return matchesSearch;
    });

    // Active members (logged in within last 7 days)
    const activeMembers = filteredMembers.filter(isActiveMember);

    // Awaiting login (needs_password_reset = true)
    const awaitingLoginMembers = filteredMembers.filter(m => m.profiles.needs_password_reset === true);

    // Inactive members (30+ days and not awaiting login)
    const inactiveMembers = filteredMembers.filter(isInactiveMember);

    return {
      all: filteredMembers,
      active: activeMembers,
      'awaiting-login': awaitingLoginMembers,
      inactive: inactiveMembers,
    };
  }, [members, searchQuery]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: members.length,
    active: filteredData.active.length,
    'awaiting-login': filteredData['awaiting-login'].length,
    inactive: filteredData.inactive.length,
  }), [members.length, filteredData]);

  const handleInviteMember = async (formData: InviteFormData) => {
    if (!workspaceId || !user) return;

    setIsSubmitting(true);
    try {
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const inviterName = inviterProfile?.full_name || inviterProfile?.email || 'A team member';

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: formData.email,
          fullName: formData.fullName,
          password: formData.password,
          workspaceId,
          workspaceName: currentWorkspace?.name || 'Workspace',
          inviterName,
          role: formData.role,
          credentialEmail: formData.credentialEmail,
        },
      });

      if (error) {
        let errorMessage = 'Failed to send invitation. Please try again.';
        if (error.message) {
          errorMessage = error.message;
        }
        throw new Error(errorMessage);
      }

      if (!data?.success) {
        toast({
          title: 'Could not invite',
          description: data?.error || 'Failed to send invitation.',
          variant: data?.code === 'ALREADY_MEMBER' ? 'default' : 'destructive',
        });
        return;
      }

      if (data.isNewUser) {
        const sentTo = data.credentialsSentTo || formData.email;
        toast({
          title: 'Invitation sent!',
          description: sentTo !== formData.email 
            ? `Credentials sent to ${sentTo} for ${formData.fullName}`
            : `${formData.fullName} will receive an email with their login credentials.`,
        });
      } else {
        toast({
          title: 'Member added!',
          description: `${formData.email} has been added to the workspace.`,
        });
      }

      setIsInviteOpen(false);
      fetchMembers();
    } catch (error) {
      console.error('Error inviting member:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCredentials = async (member: MemberWithProfile) => {
    if (!workspaceId || !user) return;

    setResendingFor(member.id);
    try {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();

      const adminName = adminProfile?.full_name || adminProfile?.email || 'A team member';
      const defaultPassword = 'Hamrotask123!';

      const { data, error } = await supabase.functions.invoke('reset-member-password', {
        body: {
          userId: member.user_id,
          newPassword: defaultPassword,
          sendCredentials: true,
          credentialEmail: member.profiles.email,
          memberName: member.profiles.full_name || member.profiles.email.split('@')[0],
          workspaceName: currentWorkspace?.name || 'Workspace',
          adminName,
        },
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to resend credentials');
      }

      toast({
        title: 'Credentials resent',
        description: `Login credentials have been sent to ${member.profiles.email}`,
      });
    } catch (error) {
      console.error('Error resending credentials:', error);
      toast({
        title: 'Error',
        description: 'Failed to resend credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResendingFor(null);
    }
  };

  const handleRoleChange = async (member: MemberWithProfile, newRole: WorkspaceRole) => {
    if (member.role === newRole) return;

    try {
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: `${member.profiles.full_name || member.profiles.email}'s role has been updated to ${newRole}.`,
      });

      fetchMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('remove-member', {
        body: {
          membershipId: memberToRemove.id,
          workspaceId,
          userId: memberToRemove.user_id,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to remove member');
      }

      if (data.userDeleted) {
        toast({
          title: 'Member removed & account deleted',
          description: `${memberToRemove.profiles.full_name || memberToRemove.profiles.email} has been removed and their account was deleted.`,
        });
      } else {
        toast({
          title: 'Member removed',
          description: `${memberToRemove.profiles.full_name || memberToRemove.profiles.email} has been removed from the workspace.`,
        });
      }

      setMemberToRemove(null);
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderMemberCard = (member: MemberWithProfile) => {
    const RoleIcon = roleIcons[member.role];
    const isCurrentUser = member.user_id === user?.id;
    const canModify = canManageMembers && !isCurrentUser && member.role !== 'owner';
    const needsSetup = member.profiles.needs_password_reset === true;
    const memberStatus = getMemberStatus(member);

    return (
      <div 
        key={member.id} 
        className={cn(
          "flex items-center gap-3 p-3 sm:p-4 rounded-xl transition-colors cursor-pointer group",
          "bg-card/50 hover:bg-card border border-border/50"
        )}
        onClick={() => setMemberToView(member)}
      >
        {/* Avatar with status indicator */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl">
            <AvatarImage src={member.profiles.avatar_url || undefined} />
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-sm sm:text-base">
              {(member.profiles.full_name || member.profiles.email)?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Status indicator dot */}
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            memberStatus === 'active' && "bg-success",
            memberStatus === 'awaiting' && "bg-warning",
            memberStatus === 'inactive' && "bg-muted-foreground/40"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm sm:text-base truncate">
              {member.profiles.full_name || member.profiles.email.split('@')[0]}
            </p>
            {isCurrentUser && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-md">
                you
              </Badge>
            )}
            {needsSetup && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 rounded-md bg-warning/10 text-warning border-warning/20">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                Awaiting login
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {member.profiles.email}
          </p>
          {member.last_active_at ? (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Active {formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true })}
            </p>
          ) : needsSetup ? (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Invited {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Badge 
            variant="outline" 
            className={cn(
              roleColors[member.role],
              'text-[10px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg'
            )}
          >
            <RoleIcon className="h-3 w-3 mr-0.5 sm:mr-1" />
            <span className="hidden xs:inline capitalize">{member.role}</span>
          </Badge>
          
          {canModify ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-48">
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); setMemberToManage(member); }}
                  className="rounded-lg cursor-pointer"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Member
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {needsSetup && (
                  <>
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); handleResendCredentials(member); }}
                      disabled={resendingFor === member.id}
                      className="rounded-lg cursor-pointer"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {resendingFor === member.id ? 'Sending...' : 'Resend Credentials'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); handleRoleChange(member, 'admin'); }}
                  className="rounded-lg cursor-pointer"
                  disabled={member.role === 'admin'}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Make Admin
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); handleRoleChange(member, 'member'); }}
                  className="rounded-lg cursor-pointer"
                  disabled={member.role === 'member'}
                >
                  <User className="h-4 w-4 mr-2" />
                  Make Member
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); handleRoleChange(member, 'viewer'); }}
                  className="rounded-lg cursor-pointer"
                  disabled={member.role === 'viewer'}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Make Viewer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); setMemberToRemove(member); }}
                  className="text-destructive rounded-lg cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>
    );
  };

  const renderEmptyState = (type: TabValue) => {
    const configs: Record<TabValue, { icon: typeof Users; title: string; description: string }> = {
      all: { icon: Users, title: 'No members yet', description: 'Invite team members to get started' },
      active: { icon: UserCheck, title: 'No active members', description: 'Members who have been active in the last 7 days will appear here' },
      'awaiting-login': { icon: Clock, title: 'All members are set up! 🎉', description: 'Everyone has completed their first login' },
      inactive: { icon: UserMinus, title: 'No inactive members', description: "Everyone's engaged — no one inactive for 30+ days!" },
    };
    const config = configs[type];

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4">
          <config.icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-foreground mb-1">{config.title}</h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
    );
  };

  const tabs = [
    { value: 'all' as const, label: 'All', icon: Users, count: tabCounts.all },
    { value: 'active' as const, label: 'Active', icon: UserCheck, count: tabCounts.active },
    { value: 'awaiting-login' as const, label: 'Awaiting Login', icon: Clock, count: tabCounts['awaiting-login'] },
    { value: 'inactive' as const, label: 'Inactive', icon: UserMinus, count: tabCounts.inactive },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Members</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage your workspace team ({members.length} member{members.length !== 1 ? 's' : ''})
          </p>
        </div>
        {canManageMembers && (
          canAddMember ? (
            <>
              <Button className="w-full sm:w-auto rounded-xl" onClick={() => setIsInviteOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
              <InviteMemberDialog
                open={isInviteOpen}
                onOpenChange={setIsInviteOpen}
                onSubmit={handleInviteMember}
                isSubmitting={isSubmitting}
              />
            </>
          ) : (
            <Button 
              className="w-full sm:w-auto rounded-xl" 
              variant="outline"
              onClick={() => setUpgradeDialogOpen(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              Member Limit ({memberCount}/{memberLimit})
            </Button>
          )
        )}
      </div>

      {/* Member Limit Warning */}
      {!canAddMember && memberLimit && (
        <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="font-medium text-sm">Member limit reached</p>
              <p className="text-xs text-muted-foreground">Upgrade to add more team members</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setUpgradeDialogOpen(true)} className="w-full sm:w-auto rounded-xl">
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade
          </Button>
        </div>
      )}

      {/* Search & Tabs */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="pb-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              Team Directory
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl h-9"
              />
            </div>
          </div>

          {/* Responsive Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
            {isMobile ? (
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-max h-auto p-1 bg-muted/50 rounded-xl gap-1">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap"
                    >
                      <tab.icon className="h-3.5 w-3.5 mr-1.5" />
                      {tab.label}
                      {tab.count > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] rounded-md">
                          {tab.count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <tab.icon className="h-4 w-4 mr-2" />
                    {tab.label}
                    {tab.count > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs rounded-md">
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
          </Tabs>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 sm:w-32 mb-2" />
                    <Skeleton className="h-3 w-32 sm:w-48" />
                  </div>
                  <Skeleton className="h-6 w-14 sm:w-16 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <Tabs value={activeTab} className="w-full">
              <TabsContent value="all" className="mt-0 space-y-2">
                {filteredData.all.length > 0 
                  ? filteredData.all.map(renderMemberCard) 
                  : renderEmptyState('all')
                }
              </TabsContent>
              
              <TabsContent value="active" className="mt-0 space-y-2">
                {filteredData.active.length > 0 
                  ? filteredData.active.map(renderMemberCard) 
                  : renderEmptyState('active')
                }
              </TabsContent>
              
              <TabsContent value="awaiting-login" className="mt-0 space-y-2">
                {filteredData['awaiting-login'].length > 0 
                  ? filteredData['awaiting-login'].map(renderMemberCard) 
                  : renderEmptyState('awaiting-login')
                }
              </TabsContent>
              
              <TabsContent value="inactive" className="mt-0 space-y-2">
                {filteredData.inactive.length > 0 
                  ? filteredData.inactive.map(renderMemberCard) 
                  : renderEmptyState('inactive')
                }
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent className="rounded-2xl mx-4 sm:mx-auto max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{memberToRemove?.profiles.full_name || memberToRemove?.profiles.email}</strong>{' '}
              from this workspace?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveMember} 
              className="rounded-xl bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        currentPlanId={subscription?.plan_id}
      />

      {/* Manage Member Dialog */}
      <ManageMemberDialog
        open={!!memberToManage}
        onOpenChange={(open) => !open && setMemberToManage(null)}
        member={memberToManage}
        workspaceId={workspaceId || ''}
        workspaceName={currentWorkspace?.name || 'Workspace'}
        currentUserId={user?.id || ''}
        onMemberUpdated={() => {
          fetchMembers();
          setMemberToManage(null);
        }}
      />

      {/* Member Detail Sheet */}
      <MemberDetailSheet
        open={!!memberToView}
        onOpenChange={(open) => !open && setMemberToView(null)}
        member={memberToView}
        workspaceId={workspaceId || ''}
        canManage={canManageMembers}
        onResendCredentials={(member) => {
          handleResendCredentials(member);
        }}
        onManageMember={(member) => {
          setMemberToView(null);
          setMemberToManage(member);
        }}
      />
    </div>
  );
}

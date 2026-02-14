import { useState, useEffect } from 'react';
import { UserPlus, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useChannelMembers } from '@/hooks/useChannelMembers';
import { cn } from '@/lib/utils';

interface WorkspaceMember {
  user_id: string;
  role: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  workspaceId: string;
  existingMemberIds: string[];
}

export function AddMemberDialog({
  open,
  onOpenChange,
  channelId,
  workspaceId,
  existingMemberIds,
}: AddMemberDialogProps) {
  const { addMember } = useChannelMembers(channelId);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Fetch workspace members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!open) return;
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select(`
            user_id,
            role,
            profile:profiles!workspace_members_user_id_fkey (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .eq('workspace_id', workspaceId);

        if (error) throw error;

        setWorkspaceMembers(
          (data || []).map(m => ({
            ...m,
            profile: m.profile as WorkspaceMember['profile'],
          }))
        );
      } catch (error) {
        console.error('Error fetching workspace members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [open, workspaceId]);

  // Filter available members
  const availableMembers = workspaceMembers.filter(
    m => !existingMemberIds.includes(m.user_id) &&
    (m.profile.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     m.profile.email.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAdd = async () => {
    setIsAdding(true);
    
    for (const userId of selectedUsers) {
      await addMember(userId, selectedRole);
    }

    setSelectedUsers([]);
    setSearch('');
    setIsAdding(false);
    onOpenChange(false);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            Add Members
          </DialogTitle>
          <DialogDescription>
            Add workspace members to this channel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Role Selection */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Add as:</span>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'member')}>
              <SelectTrigger className="w-32 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="member" className="rounded-lg">Member</SelectItem>
                <SelectItem value="admin" className="rounded-lg">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Member List */}
          <ScrollArea className="h-64">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading...
              </div>
            ) : availableMembers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {search ? 'No matching members found' : 'All workspace members are already in this channel'}
              </div>
            ) : (
              <div className="space-y-1 pr-4">
                {availableMembers.map((member) => {
                  const isSelected = selectedUsers.includes(member.user_id);
                  return (
                    <button
                      key={member.user_id}
                      onClick={() => toggleUser(member.user_id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-xl transition-all',
                        isSelected
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-9 w-9 rounded-xl">
                          <AvatarImage src={member.profile.avatar_url || undefined} />
                          <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-sm">
                            {getInitials(member.profile.full_name, member.profile.email)}
                          </AvatarFallback>
                        </Avatar>
                        {isSelected && (
                          <div className="absolute -right-1 -bottom-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium truncate">
                          {member.profile.full_name || member.profile.email.split('@')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.profile.email}
                        </p>
                      </div>

                      <Badge variant="secondary" className="rounded-lg text-xs capitalize">
                        {member.role}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedUsers.length === 0 || isAdding}
            className="rounded-xl"
          >
            {isAdding 
              ? 'Adding...' 
              : `Add ${selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

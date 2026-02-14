import { useState, useEffect } from 'react';
import { MessageSquare, Search, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface WorkspaceMember {
  id: string;
  user_id: string;
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface StartDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onStartConversation: (userId: string) => Promise<any>;
}

export function StartDMDialog({
  open,
  onOpenChange,
  workspaceId,
  onStartConversation,
}: StartDMDialogProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // Fetch workspace members
  useEffect(() => {
    if (!open || !workspaceId) return;

    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select(`
            id,
            user_id,
            profile:profiles!workspace_members_user_id_fkey(id, email, full_name, avatar_url)
          `)
          .eq('workspace_id', workspaceId)
          .neq('user_id', user?.id);

        if (error) throw error;

        const formattedMembers = (data || []).map((m: any) => ({
          ...m,
          profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
        })) as WorkspaceMember[];

        setMembers(formattedMembers);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [open, workspaceId, user]);

  // Filter members by search
  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      member.profile.email.toLowerCase().includes(searchLower) ||
      member.profile.full_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleStartConversation = async (userId: string) => {
    setIsStarting(true);
    try {
      await onStartConversation(userId);
      onOpenChange(false);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            New Message
          </DialogTitle>
          <DialogDescription>
            Start a private conversation with a team member
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>

        <ScrollArea className="flex-1 max-h-[300px] -mx-6 px-6">
          <div className="space-y-1 py-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading members...
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8">
                <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No members found' : 'No other members in this workspace'}
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleStartConversation(member.user_id)}
                  disabled={isStarting}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
                    'hover:bg-primary/5 active:scale-[0.98]',
                    isStarting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Avatar className="h-10 w-10 rounded-xl">
                    <AvatarImage src={member.profile.avatar_url || undefined} />
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-sm">
                      {member.profile.full_name?.charAt(0) || member.profile.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {member.profile.full_name || member.profile.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.profile.email}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

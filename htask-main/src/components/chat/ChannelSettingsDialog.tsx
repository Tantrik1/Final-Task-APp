import { useState } from 'react';
import { Settings, Users, Shield, Crown, UserMinus, UserPlus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useChannelMembers, ChannelMember } from '@/hooks/useChannelMembers';
import { Channel } from '@/hooks/useChat';
import { AddMemberDialog } from './AddMemberDialog';
import { cn } from '@/lib/utils';

interface ChannelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
  workspaceId: string;
  onDeleteChannel?: () => void;
}

export function ChannelSettingsDialog({
  open,
  onOpenChange,
  channel,
  workspaceId,
  onDeleteChannel,
}: ChannelSettingsDialogProps) {
  const { members, isAdmin, adminCount, removeMember, updateMemberRole, isLoading } = useChannelMembers(channel.id);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<ChannelMember | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    setActionLoading(true);
    await removeMember(removingMember.user_id);
    setActionLoading(false);
    setRemovingMember(null);
  };

  const handleRoleChange = async (member: ChannelMember, newRole: 'admin' | 'member') => {
    await updateMemberRole(member.user_id, newRole);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const isGeneral = channel.type === 'general';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-muted-foreground font-normal">#</span> {channel.name}
              </div>
            </DialogTitle>
            <DialogDescription>
              {channel.description || 'Manage channel settings and members'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col">
            {/* Members Section */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Members</span>
                <Badge variant="secondary" className="rounded-lg text-xs">
                  {members.length}
                </Badge>
              </div>
              {isAdmin && !isGeneral && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddMemberOpen(true)}
                  className="rounded-xl gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Add
                </Button>
              )}
            </div>

            <Separator />

            <ScrollArea className="flex-1 py-2">
              <div className="space-y-1">
                {isLoading ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Loading members...
                  </div>
                ) : members.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No members yet
                  </div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group"
                    >
                      <Avatar className="h-9 w-9 rounded-xl">
                        <AvatarImage src={member.profile.avatar_url || undefined} />
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-sm">
                          {getInitials(member.profile.full_name, member.profile.email)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {member.profile.full_name || member.profile.email.split('@')[0]}
                          </span>
                          {member.role === 'admin' && (
                            <Badge 
                              variant="default" 
                              className="rounded-lg text-[10px] px-1.5 py-0 h-5 bg-gradient-to-r from-primary to-primary/80 border-0"
                            >
                              <Crown className="h-3 w-3 mr-0.5" />
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.profile.email}
                        </p>
                      </div>

                      {isAdmin && !isGeneral && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl">
                            {member.role === 'member' ? (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(member, 'admin')}
                                className="cursor-pointer rounded-lg"
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                            ) : adminCount > 1 && (
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(member, 'member')}
                                className="cursor-pointer rounded-lg"
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Remove Admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setRemovingMember(member)}
                              className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove from Channel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Danger Zone */}
            {isAdmin && !isGeneral && onDeleteChannel && (
              <>
                <Separator className="my-3" />
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-destructive text-sm">Delete Channel</p>
                      <p className="text-xs text-muted-foreground">
                        This will permanently delete the channel and all messages
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onDeleteChannel}
                      className="rounded-xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        channelId={channel.id}
        workspaceId={workspaceId}
        existingMemberIds={members.map(m => m.user_id)}
      />

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={() => setRemovingMember(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">
                {removingMember?.profile.full_name || removingMember?.profile.email}
              </span>{' '}
              from this channel? They will no longer be able to see or send messages here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={actionLoading}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

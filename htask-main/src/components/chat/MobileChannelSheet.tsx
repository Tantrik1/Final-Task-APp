import { useState } from 'react';
import { Hash, ChevronDown, Lock, Plus, MessageSquare, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Channel } from '@/hooks/useChat';
import { DMConversation } from '@/hooks/useDirectMessages';
import { formatDistanceToNow } from 'date-fns';

interface MobileChannelSheetProps {
  channels: Channel[];
  activeChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChannel?: () => void;
  canManageChannels?: boolean;
  // DM props
  conversations?: DMConversation[];
  activeConversation?: DMConversation | null;
  onSelectConversation?: (conv: DMConversation) => void;
  onStartDM?: () => void;
  activeTab?: 'channels' | 'dms';
  onTabChange?: (tab: 'channels' | 'dms') => void;
  isUserOnline?: (userId: string) => boolean;
}

export function MobileChannelSheet({
  channels,
  activeChannel,
  onSelectChannel,
  open,
  onOpenChange,
  onCreateChannel,
  canManageChannels = true,
  conversations = [],
  activeConversation,
  onSelectConversation,
  onStartDM,
  activeTab = 'channels',
  onTabChange,
  isUserOnline,
}: MobileChannelSheetProps) {
  const handleSelectChannel = (channel: Channel) => {
    onSelectChannel(channel);
    onOpenChange(false);
  };

  const handleSelectDM = (conv: DMConversation) => {
    onSelectConversation?.(conv);
    onOpenChange(false);
  };

  const generalChannels = channels.filter(c => c.type === 'general');
  const privateChannels = channels.filter(c => c.type !== 'general');

  const renderChannel = (channel: Channel) => {
    const isActive = activeChannel?.id === channel.id && activeTab === 'channels';
    const isGeneral = channel.type === 'general';

    return (
      <button
        key={channel.id}
        onClick={() => handleSelectChannel(channel)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary'
            : 'hover:bg-muted/50 active:scale-[0.98]'
        )}
      >
        <div className={cn(
          'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
          isActive ? 'bg-primary/20' : 'bg-muted/50'
        )}>
          {isGeneral ? (
            <Hash className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
          ) : (
            <Lock className={cn('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-medium text-sm truncate',
            isActive && 'text-primary'
          )}>
            {channel.name}
          </p>
          {channel.description && (
            <p className="text-[10px] text-muted-foreground truncate">
              {channel.description}
            </p>
          )}
        </div>
        {(channel.unread_count || 0) > 0 && (
          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 px-1.5">
            {channel.unread_count! > 99 ? '99+' : channel.unread_count}
          </Badge>
        )}
      </button>
    );
  };

  const renderDM = (conv: DMConversation) => {
    const isActive = activeConversation?.id === conv.id && activeTab === 'dms';
    const hasUnread = (conv.unread_count || 0) > 0;
    const isOnline = conv.other_user && isUserOnline?.(conv.other_user.id);

    return (
      <button
        key={conv.id}
        onClick={() => handleSelectDM(conv)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
          isActive
            ? 'bg-gradient-to-r from-primary/15 to-primary/5'
            : 'hover:bg-muted/50 active:scale-[0.98]'
        )}
      >
        <div className="relative">
          <Avatar className="h-9 w-9 rounded-xl">
            <AvatarImage src={conv.other_user?.avatar_url || undefined} />
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-xs">
              {conv.other_user?.full_name?.charAt(0) || conv.other_user?.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn(
              'font-medium text-sm truncate',
              isActive && 'text-primary'
            )}>
              {conv.other_user?.full_name || conv.other_user?.email.split('@')[0]}
            </p>
            {conv.last_message && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
              </span>
            )}
          </div>
          {conv.last_message && (
            <p className={cn(
              'text-[10px] truncate',
              hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}>
              {conv.last_message.content}
            </p>
          )}
        </div>
        {hasUnread && (
          <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 px-1.5">
            {conv.unread_count! > 99 ? '99+' : conv.unread_count}
          </Badge>
        )}
      </button>
    );
  };

  // Determine what to show in trigger
  const triggerContent = () => {
    if (activeTab === 'dms' && activeConversation) {
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5 rounded-md">
            <AvatarImage src={activeConversation.other_user?.avatar_url || undefined} />
            <AvatarFallback className="rounded-md bg-primary/20 text-[10px]">
              {activeConversation.other_user?.full_name?.charAt(0) || activeConversation.other_user?.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium truncate">
            {activeConversation.other_user?.full_name || activeConversation.other_user?.email.split('@')[0]}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        {activeChannel?.type === 'general' ? (
          <Hash className="h-4 w-4 text-primary" />
        ) : (
          <Lock className="h-4 w-4 text-primary" />
        )}
        <span className="font-medium truncate">
          {activeChannel?.name || 'Select channel'}
        </span>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl px-3 pb-safe">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left">Messages</SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => onTabChange?.(v as 'channels' | 'dms')} className="h-[calc(100%-50px)]">
          <TabsList className="grid w-full grid-cols-2 h-10 rounded-xl mb-3">
            <TabsTrigger value="channels" className="rounded-lg gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="dms" className="rounded-lg gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              Direct Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="h-[calc(100%-52px)] mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 pb-8">
                {/* Create Channel Button */}
                {canManageChannels && onCreateChannel && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-xl h-11 border-dashed"
                    onClick={() => {
                      onOpenChange(false);
                      onCreateChannel();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Create Channel
                  </Button>
                )}

                {/* Public channels */}
                {generalChannels.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      Public
                    </div>
                    {generalChannels.map(renderChannel)}
                  </div>
                )}

                {/* Private channels */}
                {privateChannels.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Private
                    </div>
                    {privateChannels.map(renderChannel)}
                  </div>
                )}

                {channels.length === 0 && (
                  <div className="text-center py-12">
                    <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Hash className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No channels yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="dms" className="h-[calc(100%-52px)] mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 pb-8">
                {/* Start DM Button */}
                {onStartDM && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 rounded-xl h-11 border-dashed"
                    onClick={() => {
                      onOpenChange(false);
                      onStartDM();
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New Message
                  </Button>
                )}

                {/* DM conversations */}
                {conversations.length > 0 ? (
                  <div className="space-y-1">
                    {conversations.map(renderDM)}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No conversations yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

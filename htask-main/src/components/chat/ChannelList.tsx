import { useState } from 'react';
import { Hash, Plus, Lock, Users, Crown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Channel } from '@/hooks/useChat';
import { CreateChannelDialog } from './CreateChannelDialog';

interface ChannelListProps {
  channels: Channel[];
  activeChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: (name: string, description?: string) => Promise<Channel | null>;
  onDeleteChannel: (channelId: string) => Promise<boolean>;
  canManageChannels: boolean;
  onOpenSettings?: (channel: Channel) => void;
}

export function ChannelList({
  channels,
  activeChannel,
  onSelectChannel,
  onCreateChannel,
  onDeleteChannel,
  canManageChannels,
  onOpenSettings,
}: ChannelListProps) {
  const [createOpen, setCreateOpen] = useState(false);

  // Separate general channels from private channels
  const generalChannels = channels.filter(c => c.type === 'general');
  const privateChannels = channels.filter(c => c.type !== 'general');

  const renderChannel = (channel: Channel) => {
    const isActive = activeChannel?.id === channel.id;
    const isGeneral = channel.type === 'general';
    const hasUnread = (channel.unread_count || 0) > 0;

    return (
      <div key={channel.id} className="group relative">
        <button
          onClick={() => onSelectChannel(channel)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
            isActive
              ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <div className={cn(
            'h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors',
            isActive
              ? 'bg-primary/20'
              : 'bg-muted/50 group-hover:bg-muted'
          )}>
            {isGeneral ? (
              <Hash className={cn('h-4 w-4', isActive && 'text-primary')} />
            ) : (
              <Lock className={cn('h-3.5 w-3.5', isActive && 'text-primary')} />
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <span className={cn(
              'block truncate font-medium',
              isActive && 'text-primary'
            )}>
              {channel.name}
            </span>
            {channel.description && (
              <span className="block text-[10px] text-muted-foreground truncate opacity-70">
                {channel.description}
              </span>
            )}
          </div>

          {hasUnread && (
            <Badge 
              variant="default" 
              className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-gradient-to-r from-primary to-primary/80 border-0 shadow-sm"
            >
              {channel.unread_count! > 99 ? '99+' : channel.unread_count}
            </Badge>
          )}
        </button>

        {/* Settings button for private channels */}
        {!isGeneral && onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(channel);
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="rounded-lg">
              Channel settings
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-col h-full bg-gradient-to-b from-sidebar to-sidebar/95">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold">Channels</h3>
          </div>
          {canManageChannels && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl hover:bg-primary/10"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-lg">
                Create channel
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* General Channels */}
            {generalChannels.length > 0 && (
              <div className="space-y-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Public
                </div>
                {generalChannels.map(renderChannel)}
              </div>
            )}

            {/* Private Channels */}
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
                {canManageChannels && (
                  <Button
                    variant="link"
                    className="mt-2 text-primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create your first channel
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <CreateChannelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreateChannel={onCreateChannel}
      />
    </>
  );
}

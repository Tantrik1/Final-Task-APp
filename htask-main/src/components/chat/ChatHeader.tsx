import { Hash, Users, Lock, Settings, Crown, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Channel } from '@/hooks/useChat';
import { useChannelMembers } from '@/hooks/useChannelMembers';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  channel: Channel | null;
  onlineCount: number;
  memberCount: number;
  onOpenSettings?: () => void;
  compact?: boolean;
  /** Mobile: trigger to open channel/DM picker sheet */
  onOpenChannelSheet?: () => void;
}

export function ChatHeader({ channel, onlineCount, memberCount, onOpenSettings, compact, onOpenChannelSheet }: ChatHeaderProps) {
  const { members, isAdmin, memberCount: channelMemberCount } = useChannelMembers(channel?.id);
  
  const displayMembers = members.slice(0, 5);
  const remainingCount = members.length - 5;

  if (!channel) {
    return (
      <div className={cn(
        "flex items-center gap-2.5 border-b bg-background/95 backdrop-blur-sm",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}>
        <div className={cn(
          "rounded-xl bg-muted/50 flex items-center justify-center",
          compact ? "h-8 w-8" : "h-10 w-10"
        )}>
          <Hash className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-muted-foreground text-sm">Select a channel</p>
        </div>
      </div>
    );
  }

  const isGeneral = channel.type === 'general';

  return (
    <div className={cn(
      "flex items-center justify-between border-b bg-background/95 backdrop-blur-sm shrink-0",
      compact ? "px-3 py-2" : "px-4 py-3"
    )}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2.5 min-w-0",
          onOpenChannelSheet && "active:opacity-70 transition-opacity"
        )}
        onClick={onOpenChannelSheet}
        disabled={!onOpenChannelSheet}
      >
        <div className={cn(
          'rounded-xl flex items-center justify-center shrink-0',
          'bg-gradient-to-br from-primary/20 to-accent/10',
          compact ? "h-9 w-9" : "h-10 w-10"
        )}>
          {isGeneral ? (
            <Hash className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-primary")} />
          ) : (
            <Lock className={cn(compact ? "h-4 w-4" : "h-5 w-5", "text-primary")} />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className={cn("font-semibold truncate", compact ? "text-sm" : "text-base")}>{channel.name}</h2>
            {onOpenChannelSheet && (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 lg:hidden" />
            )}
            {!isGeneral && !compact && (
              <Badge variant="secondary" className="rounded-lg text-[10px] px-1.5 py-0 h-5">
                <Lock className="h-2.5 w-2.5 mr-0.5" />
                Private
              </Badge>
            )}
            {isAdmin && !compact && (
              <Badge 
                variant="default" 
                className="rounded-lg text-[10px] px-1.5 py-0 h-5 bg-gradient-to-r from-primary to-primary/80 border-0"
              >
                <Crown className="h-2.5 w-2.5 mr-0.5" />
                Admin
              </Badge>
            )}
          </div>
          {channel.description && !compact && (
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
              {channel.description}
            </p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2">
        {/* Member Avatars - hide on compact */}
        {!compact && displayMembers.length > 0 && (
          <div className="hidden sm:flex items-center">
            <div className="flex -space-x-2">
              {displayMembers.map((member) => (
                <Tooltip key={member.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-7 w-7 rounded-lg border-2 border-background cursor-default">
                      <AvatarImage src={member.profile.avatar_url || undefined} />
                      <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 text-[10px]">
                        {member.profile.full_name?.charAt(0) || member.profile.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-lg">
                    {member.profile.full_name || member.profile.email}
                  </TooltipContent>
                </Tooltip>
              ))}
              {remainingCount > 0 && (
                <div className="h-7 w-7 rounded-lg border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                  +{remainingCount}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Online/Member Count */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{onlineCount}</span>
          </div>
          <span className="text-muted-foreground/50">/</span>
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{channelMemberCount || memberCount}</span>
          </div>
        </div>

        {/* Settings Button */}
        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="h-8 w-8 rounded-xl hover:bg-primary/10"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg">
              Channel settings
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

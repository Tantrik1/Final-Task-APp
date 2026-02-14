import { useState } from 'react';
import { MessageSquare, Plus, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DMConversation } from '@/hooks/useDirectMessages';
import { StartDMDialog } from './StartDMDialog';
import { formatDistanceToNow } from 'date-fns';

interface DMListProps {
  conversations: DMConversation[];
  activeConversation: DMConversation | null;
  onSelectConversation: (conv: DMConversation) => void;
  onStartConversation: (userId: string) => Promise<DMConversation | null>;
  workspaceId: string;
  isUserOnline?: (userId: string) => boolean;
}

export function DMList({
  conversations,
  activeConversation,
  onSelectConversation,
  onStartConversation,
  workspaceId,
  isUserOnline,
}: DMListProps) {
  const [startDMOpen, setStartDMOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold">Direct Messages</h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl hover:bg-primary/10"
                onClick={() => setStartDMOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg">
              New message
            </TooltipContent>
          </Tooltip>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <Button
                  variant="link"
                  className="mt-2 text-primary"
                  onClick={() => setStartDMOpen(true)}
                >
                  Start a conversation
                </Button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversation?.id === conv.id;
                const hasUnread = (conv.unread_count || 0) > 0;
                const isOnline = conv.other_user && isUserOnline?.(conv.other_user.id);

                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-primary/15 to-primary/5 shadow-sm'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10 rounded-xl">
                        <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-sm">
                          {conv.other_user?.full_name?.charAt(0) || conv.other_user?.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <Circle className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-emerald-500 text-background stroke-[3]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'font-medium text-sm truncate',
                          isActive && 'text-primary'
                        )}>
                          {conv.other_user?.full_name || conv.other_user?.email.split('@')[0]}
                        </span>
                        {conv.last_message && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className={cn(
                          'text-xs truncate',
                          hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                        )}>
                          {conv.last_message.content}
                        </p>
                      )}
                    </div>

                    {hasUnread && (
                      <Badge
                        variant="default"
                        className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-gradient-to-r from-primary to-primary/80 border-0 shadow-sm"
                      >
                        {conv.unread_count! > 99 ? '99+' : conv.unread_count}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <StartDMDialog
        open={startDMOpen}
        onOpenChange={setStartDMOpen}
        workspaceId={workspaceId}
        onStartConversation={onStartConversation}
      />
    </>
  );
}

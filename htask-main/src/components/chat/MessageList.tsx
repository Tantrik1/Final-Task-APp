import { useRef, useEffect, useState } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowDown, Loader2 } from 'lucide-react';
import { Message } from '@/hooks/useChatMessages';
import { DMMessage } from '@/hooks/useDMMessages';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: (Message | DMMessage)[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  currentUserId: string | undefined;
  onReply?: (message: Message) => void;
  onEdit: (messageId: string, content: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  typingText?: string | null;
  isUserOnline: (userId: string) => boolean;
  isDM?: boolean;
}

export function MessageList({
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  typingText,
  isUserOnline,
  isDM = false,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Format date divider
  const formatDateDivider = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d');
  };

  // Check if we should show date divider
  const shouldShowDateDivider = (currentMsg: Message | DMMessage, prevMsg?: Message | DMMessage) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.created_at);
    const prevDate = new Date(prevMsg.created_at);
    return !isSameDay(currentDate, prevDate);
  };

  // Check if we should group messages
  const shouldGroupMessage = (currentMsg: Message | DMMessage, prevMsg?: Message | DMMessage) => {
    if (!prevMsg) return false;
    if (currentMsg.sender_id !== prevMsg.sender_id) return false;
    
    const currentTime = new Date(currentMsg.created_at).getTime();
    const prevTime = new Date(prevMsg.created_at).getTime();
    // Group messages within 5 minutes
    return currentTime - prevTime < 5 * 60 * 1000;
  };

  // Handle scroll events
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom && messages.length > 5);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && isAutoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, isAutoScroll]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [isLoading]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAutoScroll(true);
    setShowScrollButton(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={cn('flex gap-3', i % 2 === 0 ? '' : 'flex-row-reverse')}>
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-2 max-w-[60%]">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={cn('h-16 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-64')} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💬</span>
          </div>
          <h3 className="font-semibold text-lg mb-1">No messages yet</h3>
          <p className="text-muted-foreground text-sm">
            Be the first to start the conversation!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative min-h-0 flex flex-col overflow-hidden">
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ 
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="p-2 sm:p-4 space-y-0.5 sm:space-y-1 min-h-full flex flex-col">
          {/* Load more button */}
          {hasMore && (
            <div className="text-center py-3 sm:py-4 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                className="rounded-xl text-muted-foreground text-xs sm:text-sm"
              >
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                Load older messages
              </Button>
            </div>
          )}

          {/* Spacer to push content down when few messages */}
          <div className="flex-1" />

          {messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : undefined;
            const showDateDivider = shouldShowDateDivider(message, prevMessage);
            const isGrouped = shouldGroupMessage(message, prevMessage);
            const isOwn = message.sender_id === currentUserId;

            // Type guard to check if message has reply_to
            const hasReplyTo = 'reply_to' in message;

            return (
              <div key={message.id} className="shrink-0">
                {showDateDivider && (
                  <div className="flex items-center gap-2 sm:gap-4 py-3 sm:py-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground px-2">
                      {formatDateDivider(message.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <MessageBubble
                  message={message as Message}
                  isOwn={isOwn}
                  isGrouped={isGrouped}
                  onReply={!isDM && onReply && hasReplyTo ? () => onReply(message as Message) : undefined}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isOnline={isUserOnline(message.sender_id)}
                />
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingText && (
            <div className="shrink-0">
              <TypingIndicator text={typingText} />
            </div>
          )}

          <div ref={bottomRef} className="h-1 shrink-0" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          size="icon"
          className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 rounded-full shadow-lg h-8 w-8 sm:h-10 sm:w-10 z-10"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      )}
    </div>
  );
}

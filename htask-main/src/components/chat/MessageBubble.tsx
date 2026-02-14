import { useState } from 'react';
import { format } from 'date-fns';
import { Reply, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Message } from '@/hooks/useChatMessages';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGrouped: boolean;
  onReply?: () => void;
  onEdit: (messageId: string, content: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  isOnline: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  isGrouped,
  onReply,
  onEdit,
  onDelete,
  isOnline,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      return;
    }
    const success = await onEdit(message.id, editContent);
    if (success) setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(message.id);
    setIsDeleting(false);
  };

  const handleBubbleTap = () => {
    // Toggle actions on tap (mobile). Desktop uses hover.
    setShowActions((prev) => !prev);
  };

  const senderName = message.sender?.full_name || message.sender?.email?.split('@')[0] || 'User';
  const senderInitial = senderName.charAt(0).toUpperCase();

  const hasActions = onReply || isOwn;

  return (
    <div className={cn(
      'group flex gap-2 sm:gap-3',
      isOwn && 'flex-row-reverse',
      isGrouped && 'mt-0.5',
      !isGrouped && 'mt-3 sm:mt-4'
    )}>
      {/* Avatar */}
      {!isGrouped ? (
        <div className="relative shrink-0">
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
            <AvatarImage src={message.sender?.avatar_url || undefined} />
            <AvatarFallback className={cn(
              'text-xs sm:text-sm font-medium',
              isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {senderInitial}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
      ) : (
        <div className="w-8 sm:w-9 shrink-0" />
      )}

      {/* Message content */}
      <div className={cn(
        'max-w-[80%] sm:max-w-[75%] space-y-0.5 sm:space-y-1',
        isOwn && 'items-end'
      )}>
        {/* Header */}
        {!isGrouped && (
          <div className={cn(
            'flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs',
            isOwn && 'flex-row-reverse'
          )}>
            <span className="font-medium text-foreground truncate max-w-[100px] sm:max-w-none">{senderName}</span>
            <span className="text-muted-foreground shrink-0">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
            {message.is_edited && (
              <span className="text-muted-foreground italic hidden sm:inline">(edited)</span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <div className={cn(
            'flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-muted/50 border-l-2 border-primary/50',
            isOwn && 'flex-row-reverse'
          )}>
            <Reply className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground truncate">
              <span className="font-medium">
                {message.reply_to.sender?.full_name || message.reply_to.sender?.email?.split('@')[0]}:
              </span>{' '}
              {message.reply_to.content}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div className="relative group/bubble">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] rounded-xl resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-lg h-7 text-xs">
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} className="rounded-lg h-7 text-xs">
                  <Check className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm break-words select-none',
                  isOwn
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                    : 'bg-muted/80 text-foreground rounded-bl-md',
                  hasActions && 'cursor-pointer sm:cursor-auto'
                )}
                onClick={hasActions ? handleBubbleTap : undefined}
              >
                {message.content}
              </div>

              {/* Actions - hover on desktop, tap-toggle on mobile */}
              {hasActions && (
                <div className={cn(
                  'absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 sm:gap-1 transition-opacity z-10',
                  isOwn ? '-left-16 sm:-left-20' : '-right-16 sm:-right-20',
                  // Desktop: hover. Mobile: tap-toggled via showActions state
                  showActions ? 'opacity-100' : 'opacity-0 sm:group-hover/bubble:opacity-100 sm:focus-within:opacity-100'
                )}>
                  {onReply && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg bg-background/80 backdrop-blur-sm shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReply();
                        setShowActions(false);
                      }}
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {isOwn && (
                    <DropdownMenu onOpenChange={(open) => { if (!open) setShowActions(false); }}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg bg-background/80 backdrop-blur-sm shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isOwn ? 'start' : 'end'} className="rounded-xl">
                        <DropdownMenuItem
                          onClick={() => { setEditContent(message.content); setIsEditing(true); setShowActions(false); }}
                          className="cursor-pointer rounded-lg text-sm"
                        >
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="text-destructive focus:text-destructive cursor-pointer rounded-lg text-sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> {isDeleting ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Grouped message time */}
        {isGrouped && (
          <span className={cn(
            'text-[9px] sm:text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity',
            isOwn && 'text-right block'
          )}>
            {format(new Date(message.created_at), 'h:mm a')}
          </span>
        )}
      </div>
    </div>
  );
}

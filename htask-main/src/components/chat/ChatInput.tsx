import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, X, Reply, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Message } from '@/hooks/useChatMessages';

interface ChatInputProps {
  onSend: (content: string) => Promise<boolean>;
  onTyping?: () => void;
  onStopTyping?: () => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onTyping,
  onStopTyping,
  replyingTo,
  onCancelReply,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Handle mobile keyboard visibility
  useEffect(() => {
    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const heightDiff = windowHeight - viewportHeight;
      setKeyboardVisible(heightDiff > 100);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [content]);

  const handleSend = async () => {
    if (!content.trim() || isSending || disabled) return;

    setIsSending(true);
    onStopTyping?.();
    
    const success = await onSend(content.trim());
    
    if (success) {
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
    
    setIsSending(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Cancel reply on Escape
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply?.();
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    if (value.trim()) {
      onTyping?.();
    } else {
      onStopTyping?.();
    }
  };

  return (
    <div 
      className={cn(
        "border-t bg-background/95 backdrop-blur-sm shrink-0 transition-all duration-200"
      )}
    >
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b bg-muted/30">
          <Reply className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              Replying to {replyingTo.sender?.full_name || replyingTo.sender?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyingTo.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-lg shrink-0"
            onClick={onCancelReply}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-2 sm:p-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            className={cn(
              'min-h-[44px] max-h-[120px] py-3 pr-10 rounded-2xl resize-none text-sm',
              'bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50'
            )}
            rows={1}
          />
          
          {/* Emoji button (placeholder for future) */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 bottom-1 h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            disabled
          >
            <Smile className="h-5 w-5" />
          </Button>
        </div>

        <Button
          onClick={handleSend}
          disabled={!content.trim() || isSending || disabled}
          size="icon"
          className={cn(
            'h-11 w-11 rounded-2xl shrink-0 transition-all duration-200',
            content.trim() 
              ? 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20' 
              : 'bg-muted text-muted-foreground'
          )}
        >
          <Send className={cn(
            'h-5 w-5 transition-transform',
            isSending && 'animate-pulse'
          )} />
        </Button>
      </div>
    </div>
  );
}

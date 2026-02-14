import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditableTextareaProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minRows?: number;
  maxRows?: number;
}

export function InlineEditableTextarea({
  value,
  onSave,
  placeholder = 'Add a description...',
  className,
  disabled = false,
  minRows = 3,
  maxRows = 10,
}: InlineEditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
      // Auto-resize
      adjustHeight();
    }
  }, [isEditing]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const lineHeight = 24; // Approximate line height
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    }
  };

  const handleSave = async () => {
    const trimmedValue = localValue.trim();
    
    if (trimmedValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      setIsEditing(false);
    } catch {
      setError(true);
      setLocalValue(value);
      setTimeout(() => setError(false), 500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    adjustHeight();
  };

  if (disabled) {
    return (
      <div className={cn('text-sm', className)}>
        {value ? (
          <p className="whitespace-pre-wrap text-muted-foreground">{value}</p>
        ) : (
          <p className="text-muted-foreground italic flex items-center gap-2">
            <FileText className="h-4 w-4" />
            No description
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="textarea"
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Textarea
              ref={textareaRef}
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              placeholder={placeholder}
              className={cn(
                'resize-none transition-all duration-200 min-h-[80px]',
                error && 'animate-shake border-destructive ring-destructive/30',
                justSaved && 'border-success ring-success/30 ring-2',
                className
              )}
              style={{ minHeight: `${minRows * 24}px` }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Press <kbd className="px-1 py-0.5 rounded bg-muted text-xs">⌘ Enter</kbd> to save, <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Esc</kbd> to cancel
            </p>
          </motion.div>
        ) : (
          <motion.button
            key="text"
            type="button"
            onClick={() => setIsEditing(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            className={cn(
              'w-full text-left cursor-pointer rounded-xl p-3 -m-3',
              'hover:bg-muted/50 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-muted/50',
              'min-h-[60px]'
            )}
          >
            {value ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value}</p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {placeholder}
              </p>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Status indicators */}
      <AnimatePresence>
        {(isSaving || justSaved) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-2 right-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Check className="h-4 w-4 text-success" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

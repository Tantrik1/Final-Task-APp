import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditableTextProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  validate?: (value: string) => boolean;
}

export function InlineEditableText({
  value,
  onSave,
  placeholder = 'Click to edit...',
  className,
  inputClassName,
  disabled = false,
  validate,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmedValue = localValue.trim();
    
    if (validate && !validate(trimmedValue)) {
      setError(true);
      setTimeout(() => setError(false), 500);
      return;
    }

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setLocalValue(value);
      setIsEditing(false);
    }
  };

  if (disabled) {
    return (
      <span className={cn('block', className)}>
        {value || <span className="text-muted-foreground italic">{placeholder}</span>}
      </span>
    );
  }

  return (
    <div className="relative inline-flex items-center gap-2 w-full">
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="input"
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1"
          >
            <Input
              ref={inputRef}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className={cn(
                'transition-all duration-200',
                error && 'animate-shake border-destructive ring-destructive/30',
                justSaved && 'border-success ring-success/30 ring-2',
                inputClassName
              )}
            />
          </motion.div>
        ) : (
          <motion.button
            key="text"
            type="button"
            onClick={() => setIsEditing(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={cn(
              'flex-1 text-left cursor-pointer rounded-lg px-2 py-1 -mx-2 -my-1',
              'hover:bg-muted/50 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-muted/50',
              className
            )}
          >
            {value || <span className="text-muted-foreground italic">{placeholder}</span>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Status indicators */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </motion.div>
        )}
        {justSaved && !isEditing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Check className="h-4 w-4 text-success" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

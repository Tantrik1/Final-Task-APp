import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditableDatePickerProps {
  value: Date | undefined;
  onSave: (value: Date | undefined) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showClearButton?: boolean;
}

export function InlineEditableDatePicker({
  value,
  onSave,
  disabled = false,
  placeholder = 'Set due date',
  className,
  showClearButton = true,
}: InlineEditableDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(false);

  const handleSelect = async (date: Date | undefined) => {
    if (date?.getTime() === value?.getTime()) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(date);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      setIsOpen(false);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await handleSelect(undefined);
  };

  const getRelativeDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    
    const daysAway = differenceInDays(date, new Date());
    if (daysAway > 0 && daysAway <= 7) return `In ${daysAway} days`;
    if (daysAway < 0 && daysAway >= -7) return `${Math.abs(daysAway)} days ago`;
    
    return format(date, 'MMM d, yyyy');
  };

  const isOverdue = value && isPast(value) && !isToday(value);

  if (disabled) {
    return (
      <span className={cn('text-sm', className)}>
        {value ? getRelativeDate(value) : <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isSaving}
          className={cn(
            'h-auto py-1 px-2 font-normal justify-start gap-2',
            'hover:bg-muted/50 transition-all duration-200',
            error && 'animate-shake',
            justSaved && 'ring-2 ring-success/50',
            isOverdue && 'text-destructive',
            className
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarIcon className={cn('h-4 w-4', isOverdue && 'text-destructive')} />
          )}
          <span className={cn(!value && 'text-muted-foreground')}>
            {value ? getRelativeDate(value) : placeholder}
          </span>
          
          <AnimatePresence>
            {justSaved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Check className="h-3 w-3 text-success" />
              </motion.span>
            )}
          </AnimatePresence>

          {value && showClearButton && !isSaving && (
            <motion.button
              type="button"
              onClick={handleClear}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="ml-1 p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          initialFocus
          className="pointer-events-auto"
        />
        {value && showClearButton && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => handleSelect(undefined)}
            >
              <X className="h-4 w-4 mr-2" />
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

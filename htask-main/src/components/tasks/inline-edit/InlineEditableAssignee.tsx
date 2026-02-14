import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Check, User, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AssigneePicker } from '@/components/tasks/AssigneePicker';

interface Assignee {
  id: string;
  full_name: string | null;
  email: string;
}

interface InlineEditableAssigneeProps {
  value: string | null;
  assignee?: Assignee | null;
  onSave: (value: string | null) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function InlineEditableAssignee({
  value,
  assignee,
  onSave,
  disabled = false,
  className,
}: InlineEditableAssigneeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(false);

  const handleChange = async (newValue: string | null) => {
    if (newValue === value) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
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

  const getInitials = () => {
    if (assignee?.full_name) {
      return assignee.full_name.charAt(0).toUpperCase();
    }
    if (assignee?.email) {
      return assignee.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  const getDisplayName = () => {
    if (assignee?.full_name) {
      return assignee.full_name;
    }
    if (assignee?.email) {
      return assignee.email.split('@')[0];
    }
    return 'Unassigned';
  };

  if (disabled) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {assignee ? (
          <>
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{getDisplayName()}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Unassigned</span>
        )}
      </div>
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
            className
          )}
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : assignee ? (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <UserPlus className="h-3 w-3 text-muted-foreground/50" />
            </div>
          )}
          
          <span className={cn('text-sm', !assignee && 'text-muted-foreground')}>
            {getDisplayName()}
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
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <AssigneePicker 
          value={value} 
          onChange={handleChange}
        />
      </PopoverContent>
    </Popover>
  );
}

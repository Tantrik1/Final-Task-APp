import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  icon?: LucideIcon;
}

interface InlineEditableSelectProps {
  value: string;
  options: SelectOption[];
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  renderTrigger?: (option: SelectOption | undefined, isLoading: boolean) => React.ReactNode;
}

export function InlineEditableSelect({
  value,
  options,
  onSave,
  disabled = false,
  className,
  renderTrigger,
}: InlineEditableSelectProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState(false);

  const currentOption = options.find((opt) => opt.value === value);

  const handleChange = async (newValue: string) => {
    if (newValue === value) return;

    setIsSaving(true);
    try {
      await onSave(newValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch {
      setError(true);
      setTimeout(() => setError(false), 500);
    } finally {
      setIsSaving(false);
    }
  };

  if (disabled) {
    return (
      <Badge className={cn(currentOption?.color, className)}>
        {currentOption?.icon && <currentOption.icon className="h-3 w-3 mr-1" />}
        {currentOption?.label || value}
      </Badge>
    );
  }

  const defaultTrigger = (
    <Badge
      className={cn(
        'cursor-pointer transition-all duration-200 hover:scale-105',
        currentOption?.color,
        error && 'animate-shake',
        justSaved && 'ring-2 ring-success/50',
        className
      )}
    >
      {isSaving ? (
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      ) : currentOption?.icon ? (
        <currentOption.icon className="h-3 w-3 mr-1" />
      ) : null}
      {currentOption?.label || value}
      <AnimatePresence>
        {justSaved && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="ml-1"
          >
            <Check className="h-3 w-3 text-success" />
          </motion.span>
        )}
      </AnimatePresence>
    </Badge>
  );

  return (
    <Select value={value} onValueChange={handleChange} disabled={isSaving}>
      <SelectTrigger className="w-auto border-0 p-0 h-auto shadow-none bg-transparent focus:ring-0">
        {renderTrigger ? renderTrigger(currentOption, isSaving) : defaultTrigger}
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon && <option.icon className="h-4 w-4" />}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

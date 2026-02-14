import { useState, useCallback, useRef, useEffect } from 'react';

interface UseInlineEditOptions<T> {
  initialValue: T;
  onSave: (value: T) => Promise<void>;
  debounceMs?: number;
  validateFn?: (value: T) => boolean;
}

interface UseInlineEditReturn<T> {
  value: T;
  setValue: (value: T) => void;
  isSaving: boolean;
  error: string | null;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  save: () => Promise<void>;
  reset: () => void;
  hasChanges: boolean;
  justSaved: boolean;
}

export function useInlineEdit<T>({
  initialValue,
  onSave,
  debounceMs = 300,
  validateFn,
}: UseInlineEditOptions<T>): UseInlineEditReturn<T> {
  const [value, setValueInternal] = useState<T>(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const originalValueRef = useRef<T>(initialValue);
  const pendingSaveRef = useRef<T | null>(null);

  // Update initial value when it changes externally
  useEffect(() => {
    if (!isEditing && !isSaving) {
      setValueInternal(initialValue);
      originalValueRef.current = initialValue;
    }
  }, [initialValue, isEditing, isSaving]);

  const hasChanges = JSON.stringify(value) !== JSON.stringify(originalValueRef.current);

  const performSave = useCallback(async (valueToSave: T) => {
    if (validateFn && !validateFn(valueToSave)) {
      setError('Invalid value');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(valueToSave);
      originalValueRef.current = valueToSave;
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      // Revert on error
      setValueInternal(originalValueRef.current);
    } finally {
      setIsSaving(false);
      pendingSaveRef.current = null;
    }
  }, [onSave, validateFn]);

  const setValue = useCallback((newValue: T) => {
    setValueInternal(newValue);
    setError(null);
    pendingSaveRef.current = newValue;

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set up new debounce
    debounceRef.current = setTimeout(() => {
      if (pendingSaveRef.current !== null && 
          JSON.stringify(pendingSaveRef.current) !== JSON.stringify(originalValueRef.current)) {
        performSave(pendingSaveRef.current);
      }
    }, debounceMs);
  }, [debounceMs, performSave]);

  const save = useCallback(async () => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (hasChanges) {
      await performSave(value);
    }
    setIsEditing(false);
  }, [hasChanges, performSave, value]);

  const reset = useCallback(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    
    setValueInternal(originalValueRef.current);
    setError(null);
    setIsEditing(false);
    pendingSaveRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    value,
    setValue,
    isSaving,
    error,
    isEditing,
    setIsEditing,
    save,
    reset,
    hasChanges,
    justSaved,
  };
}

// Immediate save variant (no debounce) for selects/pickers
export function useInlineEditImmediate<T>({
  initialValue,
  onSave,
  validateFn,
}: Omit<UseInlineEditOptions<T>, 'debounceMs'>): UseInlineEditReturn<T> {
  return useInlineEdit({
    initialValue,
    onSave,
    debounceMs: 0,
    validateFn,
  });
}

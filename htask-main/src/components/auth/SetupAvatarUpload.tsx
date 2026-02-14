import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SetupAvatarUploadProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  previewUrl: string | null;
  name: string;
  email: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export default function SetupAvatarUpload({
  file,
  onFileChange,
  previewUrl,
  name,
  email,
}: SetupAvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate initials from name or email
  const getInitials = () => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0]?.substring(0, 2).toUpperCase() || '';
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return '?';
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'Image must be less than 2MB';
    }
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file';
    }
    return null;
  };

  const handleFile = useCallback((selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileChange(selectedFile);
  }, [onFileChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileChange(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className={cn(
          'relative w-28 h-28 rounded-full cursor-pointer transition-all duration-200',
          'ring-4 ring-background shadow-lg',
          isDragging && 'ring-primary ring-opacity-50 scale-105'
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Avatar content */}
        <AnimatePresence mode="wait">
          {previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-full h-full rounded-full overflow-hidden"
            >
              <img
                src={previewUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            </motion.div>
          ) : (
            <motion.div
              key="initials"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'w-full h-full rounded-full flex items-center justify-center',
                'bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20',
                'border-2 border-dashed border-muted-foreground/30'
              )}
            >
              <span className="text-3xl font-semibold text-primary/70">
                {getInitials()}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera overlay */}
        <motion.div
          className={cn(
            'absolute inset-0 rounded-full flex items-center justify-center',
            'bg-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200'
          )}
          whileHover={{ opacity: 1 }}
        >
          <Camera className="w-8 h-8 text-white" />
        </motion.div>

        {/* Remove button */}
        <AnimatePresence>
          {previewUrl && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              type="button"
              onClick={handleRemove}
              className={cn(
                'absolute -top-1 -right-1 w-7 h-7 rounded-full',
                'bg-destructive text-destructive-foreground',
                'flex items-center justify-center shadow-md',
                'hover:bg-destructive/90 transition-colors'
              )}
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Drag indicator */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'absolute inset-0 rounded-full flex items-center justify-center',
                'bg-primary/20 border-2 border-primary border-dashed'
              )}
            >
              <Upload className="w-8 h-8 text-primary" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Help text */}
      <p className="text-sm text-muted-foreground text-center">
        {previewUrl ? 'Click to change photo' : 'Click or drag to add a photo'}
      </p>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-destructive text-center"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}

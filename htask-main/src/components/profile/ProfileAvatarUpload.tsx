import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, Trash2, Upload, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileAvatarUploadProps {
  avatarUrl: string | null;
  fullName: string | null;
  email: string;
  onAvatarChange: (url: string | null) => void;
  className?: string;
}

export function ProfileAvatarUpload({ 
  avatarUrl, 
  fullName, 
  email, 
  onAvatarChange,
  className 
}: ProfileAvatarUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const getInitials = () => {
    if (fullName) return fullName.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return 'U';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onAvatarChange(urlData.publicUrl);

      toast({
        title: 'Avatar uploaded',
        description: 'Your profile picture has been updated.',
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !avatarUrl) return;

    setIsRemoving(true);
    try {
      // Extract file path from URL
      const url = new URL(avatarUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/');

      // Delete from storage
      await supabase.storage
        .from('user-avatars')
        .remove([filePath]);

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      onAvatarChange(null);

      toast({
        title: 'Avatar removed',
        description: 'Your profile picture has been removed.',
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-center sm:items-start gap-4", className)}>
      {/* Avatar Preview */}
      <div className="relative">
        <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-4 ring-primary/10">
          <AvatarImage 
            src={avatarUrl || undefined} 
            alt={fullName || 'Profile'}
            className="object-cover"
          />
          <AvatarFallback className="text-3xl sm:text-4xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {/* Upload overlay button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Info and Actions */}
      <div className="flex-1 text-center sm:text-left space-y-2">
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold">{fullName || 'No name set'}</h3>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Upload a photo. PNG or JPG, max 2MB.
        </p>
        
        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded-xl"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Photo
              </>
            )}
          </Button>
          
          {avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isRemoving}
              className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkspaceLogoUploadProps {
  className?: string;
}

export function WorkspaceLogoUpload({ className }: WorkspaceLogoUploadProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentWorkspace, currentRole, refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workspaceId || !canEdit) return;

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
      const fileName = `${workspaceId}/logo-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('workspace-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        // If bucket doesn't exist, create it first
        if (uploadError.message.includes('Bucket not found')) {
          toast({
            title: 'Storage not configured',
            description: 'Please contact support to enable logo uploads.',
            variant: 'destructive',
          });
          return;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workspace-logos')
        .getPublicUrl(fileName);

      // Update workspace with logo URL
      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', workspaceId);

      if (updateError) throw updateError;

      await refreshWorkspaces();

      toast({
        title: 'Logo uploaded',
        description: 'Your workspace logo has been updated.',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload logo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!workspaceId || !canEdit || !currentWorkspace?.logo_url) return;

    setIsRemoving(true);
    try {
      // Extract file path from URL
      const url = new URL(currentWorkspace.logo_url);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/'); // workspace-id/filename

      // Delete from storage
      await supabase.storage
        .from('workspace-logos')
        .remove([filePath]);

      // Update workspace to remove logo URL
      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ logo_url: null })
        .eq('id', workspaceId);

      if (updateError) throw updateError;

      await refreshWorkspaces();

      toast({
        title: 'Logo removed',
        description: 'Your workspace logo has been removed.',
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove logo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
    }
  };

  if (!canEdit) return null;

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-4", className)}>
      {/* Logo Preview */}
      <div className="relative">
        <Avatar className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl ring-4 ring-primary/10">
          <AvatarImage 
            src={currentWorkspace?.logo_url || undefined} 
            alt={currentWorkspace?.name}
            className="object-cover"
          />
          <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-2xl">
            <Building2 className="h-8 w-8 text-primary" />
          </AvatarFallback>
        </Avatar>
        
        {/* Upload overlay button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Info and Actions */}
      <div className="flex-1 space-y-2">
        <div>
          <h4 className="font-medium text-sm">Workspace Logo</h4>
          <p className="text-xs text-muted-foreground">
            Upload a logo to personalize your workspace. PNG or JPG, max 2MB.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
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
                Upload Logo
              </>
            )}
          </Button>
          
          {currentWorkspace?.logo_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveLogo}
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

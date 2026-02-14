import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Paperclip, 
  Upload, 
  File, 
  FileImage, 
  FileText, 
  FileVideo, 
  FileAudio,
  Trash2, 
  Download,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  created_at: string;
}

interface TaskAttachmentsProps {
  taskId: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.startsWith('video/')) return FileVideo;
  if (fileType.startsWith('audio/')) return FileAudio;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [taskId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const filePath = `${taskId}/${Date.now()}-${file.name}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath);

        // Save attachment record
        const { error: insertError } = await supabase.from('task_attachments').insert({
          task_id: taskId,
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: urlData.publicUrl,
        });

        if (insertError) throw insertError;

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      toast({ title: 'Files uploaded!' });
      fetchAttachments();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.file_name}"?`)) return;

    try {
      // Extract file path from URL
      const urlParts = attachment.file_url.split('/');
      const filePath = urlParts.slice(-2).join('/');

      // Delete from storage
      await supabase.storage.from('task-attachments').remove([filePath]);

      // Delete record
      const { error } = await supabase.from('task_attachments').delete().eq('id', attachment.id);
      if (error) throw error;

      toast({ title: 'Attachment deleted' });
      fetchAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          <span>Attachments ({attachments.length})</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress}%
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload
            </>
          )}
        </Button>
      </div>

      {/* Attachments list */}
      {attachments.length === 0 ? (
        <div 
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Any file type supported
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            const isImage = attachment.file_type.startsWith('image/');

            return (
              <div
                key={attachment.id}
                className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all"
              >
                {isImage ? (
                  <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={attachment.file_url}
                      alt={attachment.file_name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileIcon className="h-5 w-5 text-primary" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)} • {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(attachment.file_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {attachment.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => handleDelete(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

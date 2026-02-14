import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Link2, Plus, ExternalLink, Trash2, Globe, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface TaskLink {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
}

interface TaskLinksProps {
  taskId: string;
}

export function TaskLinks({ taskId }: TaskLinksProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '' });

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('task_links')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error fetching links:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [taskId]);

  const handleAddLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim() || !user) return;

    // Basic URL validation
    let url = newLink.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('task_links').insert({
        task_id: taskId,
        user_id: user.id,
        title: newLink.title.trim(),
        url,
      });

      if (error) throw error;

      toast({ title: 'Link added!' });
      setNewLink({ title: '', url: '' });
      setIsDialogOpen(false);
      fetchLinks();
    } catch (error) {
      console.error('Error adding link:', error);
      toast({ title: 'Error', description: 'Failed to add link', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      const { error } = await supabase.from('task_links').delete().eq('id', linkId);
      if (error) throw error;
      toast({ title: 'Link removed' });
      fetchLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Link2 className="h-4 w-4" />
          <span>Links ({links.length})</span>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="link-title">Title</Label>
                <Input
                  id="link-title"
                  placeholder="e.g., Design mockup"
                  value={newLink.title}
                  onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  placeholder="https://..."
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLink}
                  disabled={!newLink.title.trim() || !newLink.url.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    'Add Link'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Links list */}
      {links.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-6 text-center">
          <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No links added yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const favicon = getFaviconUrl(link.url);

            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                  {favicon ? (
                    <img src={favicon} alt="" className="h-5 w-5" />
                  ) : (
                    <Globe className="h-4 w-4 text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {link.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {link.url}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  {link.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(link.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

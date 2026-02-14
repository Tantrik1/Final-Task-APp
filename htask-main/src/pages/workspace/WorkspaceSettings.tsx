import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings, Building2, Trash2, Loader2, Save, ImageIcon } from 'lucide-react';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { WorkspaceLogoUpload } from '@/components/workspace/WorkspaceLogoUpload';

export default function WorkspaceSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { currentWorkspace, currentRole, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const isOwner = currentRole === 'owner';
  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setDescription(currentWorkspace.description || '');
    }
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!workspaceId || !canEdit) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', workspaceId);

      if (error) throw error;

      await refreshWorkspaces();

      toast({
        title: 'Settings saved',
        description: 'Your workspace settings have been updated.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !isOwner || deleteConfirmName !== currentWorkspace?.name) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);

      if (error) throw error;

      toast({
        title: 'Workspace deleted',
        description: 'Your workspace has been permanently deleted.',
      });

      await refreshWorkspaces();
      navigate('/');
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workspace. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access workspace settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto lg:pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your workspace configuration</p>
      </div>

      {/* Branding */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-accent" />
            </div>
            Branding
          </CardTitle>
          <CardDescription>Customize your workspace appearance</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceLogoUpload />
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            General
          </CardTitle>
          <CardDescription>Basic workspace information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name *</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Workspace"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-description">Description</Label>
            <Textarea
              id="workspace-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
            className="w-full sm:w-auto rounded-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferences />

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-destructive/50 rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-destructive text-lg sm:text-xl">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that will permanently affect your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto rounded-xl">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 sm:mx-auto rounded-2xl max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the workspace{' '}
                    <strong>{currentWorkspace?.name}</strong> and all of its projects, tasks, and data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <Label htmlFor="delete-confirm">
                    Type <strong>{currentWorkspace?.name}</strong> to confirm:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder="Workspace name"
                    className="mt-2 rounded-xl"
                  />
                </div>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel onClick={() => setDeleteConfirmName('')} className="rounded-xl">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteConfirmName !== currentWorkspace?.name || isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete Workspace'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

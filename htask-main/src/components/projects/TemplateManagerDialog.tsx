import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjectTemplates, ProjectTemplate } from '@/hooks/useProjectTemplates';
import { useWorkspace } from '@/hooks/useWorkspace';
import { SystemTemplate } from '@/data/systemTemplates';
import { TemplateGallery } from './TemplateGallery';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  Copy,
  FolderPlus,
  Sparkles,
  FileText,
  Workflow,
  ListTodo,
  Building2,
} from 'lucide-react';

interface TemplateManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateManagerDialog({ open, onOpenChange }: TemplateManagerDialogProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { currentRole } = useWorkspace();
  const {
    templates,
    isLoading,
    createTemplate,
    deleteTemplate,
    createProjectFromTemplate,
    createProjectFromSystemTemplate,
  } = useProjectTemplates(workspaceId);

  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  const handleCreate = async () => {
    if (!newName.trim()) return;

    await createTemplate({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      statuses: [
        { name: 'To Do', color: '#94a3b8', position: 0, is_default: true, is_completed: false },
        { name: 'In Progress', color: '#f97316', position: 1, is_default: false, is_completed: false },
        { name: 'Review', color: '#8b5cf6', position: 2, is_default: false, is_completed: false },
        { name: 'Done', color: '#22c55e', position: 3, is_default: false, is_completed: true },
      ],
    });

    setNewName('');
    setNewDescription('');
    setIsCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTemplate(deleteId);
    setDeleteId(null);
  };

  const handleUseTemplate = async () => {
    if (!useTemplateId || !projectName.trim()) return;

    const projectId = await createProjectFromTemplate(useTemplateId, projectName.trim());
    if (projectId) {
      setUseTemplateId(null);
      setProjectName('');
      onOpenChange(false);
      navigate(`/workspace/${workspaceId}/projects/${projectId}`);
    }
  };

  const handleSystemTemplateSelect = async (template: SystemTemplate, name: string) => {
    setIsCreatingProject(true);
    const projectId = await createProjectFromSystemTemplate(template, name);
    setIsCreatingProject(false);
    if (projectId) {
      onOpenChange(false);
      navigate(`/workspace/${workspaceId}/projects/${projectId}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Project Templates
            </DialogTitle>
            <DialogDescription>
              Start with a pre-built template or create your own to speed up project creation.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* System Templates Gallery */}
            <TemplateGallery
              onSelectTemplate={handleSystemTemplateSelect}
              isCreating={isCreatingProject}
            />

            <Separator />

            {/* Workspace Templates Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Your Templates</span>
                </div>
                {canManage && !isCreating && (
                  <Button onClick={() => setIsCreating(true)} variant="outline" size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create
                  </Button>
                )}
              </div>

              {isCreating && (
                <Card className="border-dashed border-2">
                  <CardContent className="p-4 space-y-4">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Template name"
                      autoFocus
                    />
                    <Textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleCreate} size="sm">Create Template</Button>
                      <Button onClick={() => setIsCreating(false)} variant="ghost" size="sm">Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Copy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No custom templates yet</p>
                  <p className="text-xs">Save a project as template to reuse its structure</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(template => (
                    <Card key={template.id} className="group hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${template.color}20` }}
                          >
                            <Sparkles
                              className="h-5 w-5"
                              style={{ color: template.color }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{template.name}</h3>
                            {template.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{template.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => {
                                setUseTemplateId(template.id);
                                setProjectName(`${template.name} Project`);
                              }}
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                              Use
                            </Button>
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                                onClick={() => setDeleteId(template.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Use Workspace Template Dialog */}
      <Dialog open={!!useTemplateId} onOpenChange={() => setUseTemplateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
            <DialogDescription>
              Enter a name for your new project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUseTemplateId(null)}>Cancel</Button>
            <Button onClick={handleUseTemplate} className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings, 
  Workflow, 
  FileText, 
  Palette, 
  ChevronRight,
  Sparkles,
  Archive,
  Trash2,
  Save,
  Info,
  AlertTriangle
} from 'lucide-react';
import { StatusManager } from './StatusManager';
import { CustomFieldsManager } from './CustomFieldsManager';
import { Database } from '@/integrations/supabase/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

type Project = Database['public']['Tables']['projects']['Row'];

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6', '#06b6d4',
];

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onProjectUpdate?: () => void;
}

type SettingsSection = 'workflow' | 'fields' | 'general' | 'danger';

const SECTIONS: { id: SettingsSection; label: string; icon: typeof Workflow; description: string }[] = [
  { id: 'workflow', label: 'Workflow', icon: Workflow, description: 'Status columns for Kanban' },
  { id: 'fields', label: 'Custom Fields', icon: FileText, description: 'Extra data fields for tasks' },
  { id: 'general', label: 'General', icon: Palette, description: 'Name, color, and settings' },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, description: 'Archive or delete project' },
];

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  project,
  onProjectUpdate,
}: ProjectSettingsDialogProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [activeSection, setActiveSection] = useState<SettingsSection>('workflow');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // General settings state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [color, setColor] = useState(project.color || '#6366f1');
  const [isArchived, setIsArchived] = useState(project.is_archived);

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name,
          description: description || null,
          color,
          is_archived: isArchived,
        })
        .eq('id', project.id);

      if (error) throw error;
      
      toast({ title: '✅ Project updated' });
      onProjectUpdate?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;
      
      toast({ title: '🗑️ Project deleted' });
      onOpenChange(false);
      onProjectUpdate?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'workflow':
        return <StatusManager projectId={project.id} />;
      
      case 'fields':
        return <CustomFieldsManager projectId={project.id} />;
      
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-1">Project Details</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Basic information about your project
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Project"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this project is about..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Project Color</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        'h-8 w-8 rounded-lg transition-all',
                        color === c && 'ring-2 ring-offset-2 ring-primary scale-110'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="archived">Archive Project</Label>
                  <p className="text-xs text-muted-foreground">
                    Hidden from active projects but data is preserved
                  </p>
                </div>
                <Switch
                  id="archived"
                  checked={isArchived}
                  onCheckedChange={setIsArchived}
                />
              </div>
            </div>

            <Button 
              onClick={handleSaveGeneral} 
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        );
      
      case 'danger':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-destructive mb-1">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Irreversible and destructive actions
              </p>
            </div>

            <Card className="border-destructive/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <Archive className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Archive Project</CardTitle>
                    <CardDescription>
                      Hide project from active list. Can be restored later.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsArchived(!isArchived);
                    handleSaveGeneral();
                  }}
                >
                  {isArchived ? 'Unarchive Project' : 'Archive Project'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-destructive">Delete Project</CardTitle>
                    <CardDescription>
                      Permanently delete this project and all its tasks. This cannot be undone.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              </CardContent>
            </Card>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{project.name}" and all associated tasks, 
                    comments, attachments, and custom field data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteProject}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Mobile uses Sheet (bottom drawer)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-2xl">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-4 pb-2 border-b">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: `${project.color || '#6366f1'}20`,
                  }}
                >
                  <Sparkles
                    className="h-5 w-5"
                    style={{ color: project.color || '#6366f1' }}
                  />
                </div>
                <div className="text-left">
                  <SheetTitle className="text-lg">{project.name}</SheetTitle>
                  <SheetDescription>Project Settings</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* Section Tabs - Horizontal scroll */}
            <div className="border-b">
              <ScrollArea className="w-full">
                <div className="flex p-2 gap-2">
                  {SECTIONS.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all',
                          isActive 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4">
              {renderSectionContent()}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop uses Dialog with sidebar
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-[70vh]">
          {/* Sidebar */}
          <div className="w-64 border-r bg-muted/30 flex flex-col">
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: `${project.color || '#6366f1'}20`,
                  }}
                >
                  <Sparkles
                    className="h-6 w-6"
                    style={{ color: project.color || '#6366f1' }}
                  />
                </div>
                <div>
                  <DialogTitle className="text-lg truncate max-w-[140px]">
                    {project.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Project Settings
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <nav className="flex-1 px-3 space-y-1">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group',
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5",
                      section.id === 'danger' && !isActive && 'text-destructive'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "font-medium text-sm",
                        section.id === 'danger' && !isActive && 'text-destructive'
                      )}>
                        {section.label}
                      </div>
                      <div className={cn(
                        "text-xs truncate",
                        isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        {section.description}
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform",
                      isActive && "translate-x-0.5"
                    )} />
                  </button>
                );
              })}
            </nav>

            {/* Sidebar footer */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                <span>Changes are auto-saved</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Content Header */}
            <div className="p-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                {(() => {
                  const section = SECTIONS.find(s => s.id === activeSection);
                  const Icon = section?.icon || Settings;
                  return (
                    <>
                      <div className={cn(
                        "p-2 rounded-xl",
                        activeSection === 'danger' ? 'bg-destructive/10' : 'bg-primary/10'
                      )}>
                        <Icon className={cn(
                          "h-5 w-5",
                          activeSection === 'danger' ? 'text-destructive' : 'text-primary'
                        )} />
                      </div>
                      <div>
                        <h2 className={cn(
                          "font-semibold text-lg",
                          activeSection === 'danger' && 'text-destructive'
                        )}>
                          {section?.label}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {section?.description}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Content Body */}
            <ScrollArea className="flex-1 p-6">
              {renderSectionContent()}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

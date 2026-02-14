import { useState } from 'react';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/data/systemTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Megaphone,
  Briefcase,
  Code,
  Headphones,
  Settings,
  DollarSign,
  FolderKanban,
  CheckSquare,
  Workflow,
  FileText,
  LayoutGrid,
  FolderPlus,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconComponents: Record<string, React.ElementType> = {
  megaphone: Megaphone,
  briefcase: Briefcase,
  code: Code,
  headphones: Headphones,
  settings: Settings,
  'dollar-sign': DollarSign,
  'folder-kanban': FolderKanban,
  'check-square': CheckSquare,
};

interface TemplateGalleryProps {
  onSelectTemplate: (template: SystemTemplate, projectName: string) => void;
  isCreating?: boolean;
}

export function TemplateGallery({ onSelectTemplate, isCreating }: TemplateGalleryProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<SystemTemplate | null>(null);
  const [projectName, setProjectName] = useState('');

  const handleSelect = (template: SystemTemplate) => {
    setSelectedTemplate(template);
    setProjectName(`${template.name} Project`);
  };

  const handleCreate = () => {
    if (selectedTemplate && projectName.trim()) {
      onSelectTemplate(selectedTemplate, projectName.trim());
      setSelectedTemplate(null);
      setProjectName('');
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>Starter Templates</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SYSTEM_TEMPLATES.map((template) => {
            const IconComponent = iconComponents[template.icon] || FolderKanban;

            return (
              <Card
                key={template.id}
                className={cn(
                  'group cursor-pointer transition-all duration-200',
                  'hover:shadow-lg hover:scale-[1.02]',
                  'border border-border/50'
                )}
                style={{
                  background: `linear-gradient(135deg, ${template.color}08 0%, ${template.color}03 100%)`,
                }}
                onClick={() => handleSelect(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${template.color}20`,
                      }}
                    >
                      <IconComponent
                        className="h-5 w-5"
                        style={{ color: template.color }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{template.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {template.description}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Workflow className="h-2.5 w-2.5" />
                          {template.statuses.length}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <FileText className="h-2.5 w-2.5" />
                          {template.fields.length}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <LayoutGrid className="h-2.5 w-2.5" />
                          {template.views.length}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate && (
                <>
                  {(() => {
                    const IconComponent = iconComponents[selectedTemplate.icon] || FolderKanban;
                    return (
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${selectedTemplate.color}20` }}
                      >
                        <IconComponent
                          className="h-4 w-4"
                          style={{ color: selectedTemplate.color }}
                        />
                      </div>
                    );
                  })()}
                  Create from {selectedTemplate.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              This project will include {selectedTemplate?.statuses.length} workflow stages,{' '}
              {selectedTemplate?.fields.length} custom fields, and{' '}
              {selectedTemplate?.views.length} views.
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 py-4">
              {/* Preview workflow */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Workflow</label>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.statuses.map((status, i) => (
                    <Badge
                      key={status.name}
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: status.color,
                        color: status.color,
                        backgroundColor: `${status.color}10`,
                      }}
                    >
                      {status.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Preview fields */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Custom Fields</label>
                <div className="flex flex-wrap gap-1">
                  {selectedTemplate.fields.map((field) => (
                    <Badge key={field.name} variant="secondary" className="text-xs">
                      {field.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Project name input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!projectName.trim() || isCreating}
              className="gap-2"
            >
              <FolderPlus className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

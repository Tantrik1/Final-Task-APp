import { useState } from 'react';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/data/systemTemplates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Megaphone,
  Briefcase,
  Code,
  Headphones,
  Settings,
  DollarSign,
  FolderKanban,
  CheckSquare,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (template: SystemTemplate | null) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  megaphone: Megaphone,
  briefcase: Briefcase,
  code: Code,
  headphones: Headphones,
  settings: Settings,
  'dollar-sign': DollarSign,
  'folder-kanban': FolderKanban,
  'check-square': CheckSquare,
};

export function TemplateSelector({ onSelect, onSkip, isLoading }: TemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleContinue = () => {
    const template = SYSTEM_TEMPLATES.find(t => t.id === selectedId);
    onSelect(template || null);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Choose Your Workflow</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Start with a pre-built template optimized for your team type. You can customize it later.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
        {SYSTEM_TEMPLATES.map((template) => {
          const Icon = iconMap[template.icon] || FolderKanban;
          const isSelected = selectedId === template.id;

          return (
            <Card
              key={template.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
                isSelected && 'ring-2 ring-primary shadow-lg shadow-primary/10'
              )}
              onClick={() => setSelectedId(template.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${template.color}20` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: template.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{template.name}</h3>
                      {isSelected && (
                        <Badge variant="default" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {template.description}
                    </p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {template.statuses.length} statuses
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {template.fields.length} fields
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onSkip} className="flex-1" disabled={isLoading}>
          Skip for now
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!selectedId || isLoading}
          className="flex-1"
          variant="gradient"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          Continue
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Search, Eye, EyeOff, FolderKanban, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SYSTEM_TEMPLATES } from '@/data/systemTemplates';

interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_public: boolean;
  is_system: boolean;
  workspace_name: string;
  created_at: string;
}

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('project_templates')
        .select(`
          *,
          workspace:workspaces(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformed: WorkspaceTemplate[] =
        data?.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          icon: t.icon,
          color: t.color,
          is_public: t.is_public,
          is_system: t.is_system ?? false,
          workspace_name: (t.workspace as any)?.name ?? 'Unknown',
          created_at: t.created_at,
        })) ?? [];

      setTemplates(transformed);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublic = async (template: WorkspaceTemplate) => {
    const { error } = await supabase
      .from('project_templates')
      .update({ is_public: !template.is_public })
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to update template');
    } else {
      toast.success(`Template ${!template.is_public ? 'made public' : 'made private'}`);
      fetchTemplates();
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.workspace_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Templates</h1>
        <p className="text-muted-foreground">Manage system and workspace templates</p>
      </div>

      {/* System Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            System Templates
          </CardTitle>
          <CardDescription>Pre-built templates available to all workspaces (code-defined)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {SYSTEM_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="p-3 rounded-lg border flex items-center gap-3"
                style={{ borderColor: template.color + '40' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                  style={{ backgroundColor: template.color }}
                >
                  {template.icon === 'megaphone' && '📣'}
                  {template.icon === 'trending-up' && '📈'}
                  {template.icon === 'code' && '💻'}
                  {template.icon === 'headphones' && '🎧'}
                  {template.icon === 'settings' && '⚙️'}
                  {template.icon === 'calculator' && '🧮'}
                  {template.icon === 'briefcase' && '💼'}
                  {template.icon === 'check-square' && '✅'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.statuses.length} statuses · {template.fields.length} fields
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Templates */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Workspace Templates
              </CardTitle>
              <CardDescription>Custom templates created by workspaces</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTemplates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? 'No templates match your search' : 'No custom templates created yet'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: template.color ?? '#6366f1' }}
                    >
                      <FolderKanban className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{template.name}</h3>
                        {template.is_public && (
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Public
                          </Badge>
                        )}
                        {template.is_system && (
                          <Badge variant="outline" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {template.workspace_name}
                        {template.description && ` · ${template.description}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {template.is_public ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Switch
                        checked={template.is_public}
                        onCheckedChange={() => handleTogglePublic(template)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

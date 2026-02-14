import { useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { SitePage, PageContent, useUpdateSitePage, useCreateSitePage } from '@/hooks/useSitePage';

interface PageEditorDialogProps {
  page: SitePage | null;
  open: boolean;
  onClose: () => void;
}

export default function PageEditorDialog({ page, open, onClose }: PageEditorDialogProps) {
  const updatePage = useUpdateSitePage();
  const createPage = useCreateSitePage();
  const isEditing = !!page;

  const [formData, setFormData] = useState({
    title: page?.title || '',
    slug: page?.slug || '',
    meta_description: page?.meta_description || '',
    category: page?.category || 'company',
    is_published: page?.is_published || false,
    content: page?.content || { hero: { title: '', subtitle: '' }, sections: [] },
  });

  const [contentJson, setContentJson] = useState(
    JSON.stringify(formData.content, null, 2)
  );

  const handleSave = async () => {
    try {
      // Parse content JSON
      let parsedContent: PageContent;
      try {
        parsedContent = JSON.parse(contentJson);
      } catch {
        toast.error('Invalid JSON in content');
        return;
      }

      if (isEditing && page) {
        await updatePage.mutateAsync({
          id: page.id,
          title: formData.title,
          slug: formData.slug,
          meta_description: formData.meta_description,
          category: formData.category as 'product' | 'company' | 'resources' | 'legal',
          is_published: formData.is_published,
          content: parsedContent,
        });
        toast.success('Page updated');
      } else {
        await createPage.mutateAsync({
          title: formData.title,
          slug: formData.slug,
          meta_description: formData.meta_description,
          category: formData.category as 'product' | 'company' | 'resources' | 'legal',
          is_published: formData.is_published,
          content: parsedContent,
          icon: 'file-text',
          position: 0,
        });
        toast.success('Page created');
      }
      onClose();
    } catch (error) {
      toast.error('Failed to save page');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Page' : 'Create Page'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the page content and settings' : 'Add a new page to your site'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="settings" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="content">Content (JSON)</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Page Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="About Us"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground mr-1">/</span>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="about"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meta_description">Meta Description (SEO)</Label>
              <Textarea
                id="meta_description"
                value={formData.meta_description}
                onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                placeholder="A brief description for search engines..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {formData.meta_description.length}/160 characters recommended
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: 'company' | 'legal') => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Published</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formData.is_published ? 'Live' : 'Draft'}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hero" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Hero Title</Label>
              <Input
                value={(formData.content.hero?.title) || ''}
                onChange={(e) => {
                  const newContent = {
                    ...formData.content,
                    hero: { ...formData.content.hero, title: e.target.value }
                  };
                  setFormData({ ...formData, content: newContent });
                  setContentJson(JSON.stringify(newContent, null, 2));
                }}
                placeholder="Page title displayed at the top"
              />
            </div>
            <div className="space-y-2">
              <Label>Hero Subtitle</Label>
              <Textarea
                value={(formData.content.hero?.subtitle) || ''}
                onChange={(e) => {
                  const newContent = {
                    ...formData.content,
                    hero: { ...formData.content.hero, subtitle: e.target.value }
                  };
                  setFormData({ ...formData, content: newContent });
                  setContentJson(JSON.stringify(newContent, null, 2));
                }}
                placeholder="A brief description below the title"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Content JSON</Label>
              <Textarea
                value={contentJson}
                onChange={(e) => setContentJson(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder='{"hero": {...}, "sections": [...]}'
              />
              <p className="text-xs text-muted-foreground">
                Edit the raw JSON structure for full control over page content.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updatePage.isPending || createPage.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Update Page' : 'Create Page'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

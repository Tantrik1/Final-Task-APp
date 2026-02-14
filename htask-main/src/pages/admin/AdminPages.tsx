import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2,
  FileText,
  Building2,
  Scale
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import { useCMSPages, useUpdateSitePage, useDeleteSitePage, SitePage } from '@/hooks/useSitePage';
import PageEditorDialog from './PageEditorDialog';

export default function AdminPages() {
  const { data: pages, isLoading } = useCMSPages();
  const updatePage = useUpdateSitePage();
  const deletePage = useDeleteSitePage();
  
  const [search, setSearch] = useState('');
  const [editingPage, setEditingPage] = useState<SitePage | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const filteredPages = pages?.filter(page => 
    page.title.toLowerCase().includes(search.toLowerCase()) ||
    page.slug.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const companyPages = filteredPages.filter(p => p.category === 'company');
  const legalPages = filteredPages.filter(p => p.category === 'legal');

  const handleTogglePublish = async (page: SitePage) => {
    try {
      await updatePage.mutateAsync({
        id: page.id,
        is_published: !page.is_published,
      });
      toast.success(page.is_published ? 'Page unpublished' : 'Page published');
    } catch {
      toast.error('Failed to update page');
    }
  };

  const handleDelete = async (page: SitePage) => {
    try {
      await deletePage.mutateAsync(page.id);
      toast.success('Page deleted');
    } catch {
      toast.error('Failed to delete page');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const PageList = ({ pages, title, icon: Icon }: { pages: SitePage[]; title: string; icon: typeof FileText }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{pages.length} pages</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {pages.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No pages in this category
          </div>
        ) : (
          <div className="divide-y">
            {pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{page.title}</h3>
                      {page.is_published ? (
                        <Badge variant="default" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Draft
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">/{page.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={page.is_published}
                    onCheckedChange={() => handleTogglePublish(page)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingPage(page)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Page</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{page.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(page)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Site Pages</h1>
          <p className="text-muted-foreground">Manage company and legal pages</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Page
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search pages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Page Lists */}
      <div className="space-y-6">
        <PageList pages={companyPages} title="Company Pages" icon={Building2} />
        <PageList pages={legalPages} title="Legal Pages" icon={Scale} />
      </div>

      {/* Editor Dialog */}
      {(editingPage || isCreating) && (
        <PageEditorDialog
          page={editingPage}
          open={!!editingPage || isCreating}
          onClose={() => {
            setEditingPage(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}

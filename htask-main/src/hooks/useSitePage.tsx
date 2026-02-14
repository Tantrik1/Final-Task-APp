import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface PageContent {
  hero?: {
    title: string;
    subtitle?: string;
    image?: string;
  };
  sections?: Array<{
    type: 'text' | 'features_grid' | 'cta' | 'faq';
    content?: string;
    title?: string;
    button_text?: string;
    button_link?: string;
    items?: Array<{
      icon?: string;
      title?: string;
      description?: string;
      question?: string;
      answer?: string;
    }>;
  }>;
}

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  content: PageContent;
  is_published: boolean;
  category: 'product' | 'company' | 'resources' | 'legal';
  icon: string | null;
  position: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSitePage(slug: string) {
  return useQuery({
    queryKey: ['site-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_pages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return {
        ...data,
        content: data.content as unknown as PageContent,
      } as SitePage;
    },
    enabled: !!slug,
  });
}

export function useSitePages() {
  return useQuery({
    queryKey: ['site-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_pages')
        .select('*')
        .order('category')
        .order('position');

      if (error) throw error;
      return data.map(page => ({
        ...page,
        content: page.content as unknown as PageContent,
      })) as SitePage[];
    },
  });
}

// Only get CMS-managed pages (company + legal)
export function useCMSPages() {
  return useQuery({
    queryKey: ['cms-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_pages')
        .select('*')
        .in('category', ['company', 'legal'])
        .order('category')
        .order('position');

      if (error) throw error;
      return data.map(page => ({
        ...page,
        content: page.content as unknown as PageContent,
      })) as SitePage[];
    },
  });
}

export function useUpdateSitePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, content, ...updates }: Partial<SitePage> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('site_pages')
        .update({ 
          ...updates, 
          content: content as unknown as Json,
          updated_by: user?.id 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        content: data.content as unknown as PageContent,
      } as SitePage;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['site-pages'] });
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
      queryClient.invalidateQueries({ queryKey: ['site-page', data.slug] });
    },
  });
}

export function useCreateSitePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (page: Omit<SitePage, 'id' | 'created_at' | 'updated_at' | 'updated_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { content, ...rest } = page;
      const { data, error } = await supabase
        .from('site_pages')
        .insert({ 
          ...rest, 
          content: content as unknown as Json,
          updated_by: user?.id 
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        content: data.content as unknown as PageContent,
      } as SitePage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-pages'] });
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
    },
  });
}

export function useDeleteSitePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('site_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-pages'] });
      queryClient.invalidateQueries({ queryKey: ['cms-pages'] });
    },
  });
}

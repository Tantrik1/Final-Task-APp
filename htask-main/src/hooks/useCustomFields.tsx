import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'url' | 'currency' | 'user' | 'multiselect' | 'file';

export interface SelectOption {
  label: string;
  value: string;
  color?: string;
}

export interface CustomFieldDefinition {
  id: string;
  project_id: string;
  name: string;
  field_type: CustomFieldType;
  options: SelectOption[];
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskCustomFieldValue {
  id: string;
  task_id: string;
  field_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_boolean: boolean | null;
}

export function useCustomFields(projectId: string | undefined) {
  const { toast } = useToast();
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFields = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Parse options from JSONB with proper typing
      const parsed = (data || []).map(field => ({
        ...field,
        options: (Array.isArray(field.options) ? field.options : []) as unknown as SelectOption[],
      })) as CustomFieldDefinition[];
      
      setFields(parsed);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`custom-fields-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_field_definitions',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchFields();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchFields]);

  const createField = async (data: {
    name: string;
    field_type: CustomFieldType;
    options?: SelectOption[];
    is_required?: boolean;
  }) => {
    if (!projectId) return null;

    try {
      const maxPosition = Math.max(...fields.map(f => f.position), -1);

      const insertData = {
        project_id: projectId,
        name: data.name,
        field_type: data.field_type,
        options: JSON.parse(JSON.stringify(data.options || [])),
        is_required: data.is_required || false,
        position: maxPosition + 1,
      };

      const { data: newField, error } = await supabase
        .from('custom_field_definitions')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      toast({ title: '✅ Field created' });
      return newField;
    } catch (error: any) {
      console.error('Error creating field:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return null;
    }
  };

  const updateField = async (id: string, data: Partial<Pick<CustomFieldDefinition, 'name' | 'is_required'>> & { options?: SelectOption[] }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.is_required !== undefined) updateData.is_required = data.is_required;
      if (data.options !== undefined) updateData.options = data.options as unknown as Record<string, unknown>[];

      const { error } = await supabase
        .from('custom_field_definitions')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast({ title: '✅ Field updated' });
      return true;
    } catch (error: any) {
      console.error('Error updating field:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: '🗑️ Field deleted' });
      return true;
    } catch (error: any) {
      console.error('Error deleting field:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  return {
    fields,
    isLoading,
    createField,
    updateField,
    deleteField,
    refresh: fetchFields,
  };
}

// Hook for managing task field values
export function useTaskCustomFieldValues(taskId: string | undefined) {
  const { toast } = useToast();
  const [values, setValues] = useState<TaskCustomFieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchValues = useCallback(async () => {
    if (!taskId) return;

    try {
      const { data, error } = await supabase
        .from('task_custom_field_values')
        .select('*')
        .eq('task_id', taskId);

      if (error) throw error;
      setValues(data || []);
    } catch (error) {
      console.error('Error fetching field values:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

  const setValue = async (fieldId: string, value: {
    text?: string | null;
    number?: number | null;
    date?: string | null;
    boolean?: boolean | null;
  }) => {
    if (!taskId) return false;

    try {
      const { error } = await supabase
        .from('task_custom_field_values')
        .upsert({
          task_id: taskId,
          field_id: fieldId,
          value_text: value.text ?? null,
          value_number: value.number ?? null,
          value_date: value.date ?? null,
          value_boolean: value.boolean ?? null,
        }, {
          onConflict: 'task_id,field_id',
        });

      if (error) throw error;
      fetchValues();
      return true;
    } catch (error: any) {
      console.error('Error setting field value:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const getValue = (fieldId: string) => values.find(v => v.field_id === fieldId);

  return {
    values,
    isLoading,
    setValue,
    getValue,
    refresh: fetchValues,
  };
}

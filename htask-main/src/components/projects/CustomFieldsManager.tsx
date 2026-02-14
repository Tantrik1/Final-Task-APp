import { useState } from 'react';
import { useCustomFields, CustomFieldType, SelectOption } from '@/hooks/useCustomFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  Link,
  DollarSign,
  User,
  Tags,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FIELD_TYPES: { value: CustomFieldType; label: string; icon: typeof Type }[] = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'multiselect', label: 'Multi-select', icon: Tags },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'url', label: 'URL', icon: Link },
  { value: 'currency', label: 'Currency', icon: DollarSign },
  { value: 'user', label: 'Team Member', icon: User },
  { value: 'file', label: 'File', icon: File },
];

interface CustomFieldsManagerProps {
  projectId: string;
}

export function CustomFieldsManager({ projectId }: CustomFieldsManagerProps) {
  const { fields, isLoading, createField, updateField, deleteField } = useCustomFields(projectId);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState<SelectOption[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAddOption = () => {
    if (!newOptionInput.trim()) return;
    setNewOptions([
      ...newOptions,
      { label: newOptionInput.trim(), value: newOptionInput.trim().toLowerCase().replace(/\s+/g, '_') }
    ]);
    setNewOptionInput('');
  };

  const handleRemoveOption = (index: number) => {
    setNewOptions(newOptions.filter((_, i) => i !== index));
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;

    const needsOptions = newType === 'select' || newType === 'multiselect';
    await createField({
      name: newName.trim(),
      field_type: newType,
      options: needsOptions ? newOptions : [],
      is_required: newRequired,
    });

    setNewName('');
    setNewType('text');
    setNewRequired(false);
    setNewOptions([]);
    setIsAdding(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteField(deleteId);
    setDeleteId(null);
  };

  const getFieldIcon = (type: CustomFieldType) => {
    const config = FIELD_TYPES.find(t => t.value === type);
    return config?.icon || Type;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Custom Fields</h3>
          <p className="text-sm text-muted-foreground">
            Add custom fields to capture more task data
          </p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Field
          </Button>
        )}
      </div>

      {/* Add new field form */}
      {isAdding && (
        <Card className="border-dashed border-2">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Field name"
                autoFocus
              />
              <Select value={newType} onValueChange={(v) => setNewType(v as CustomFieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Options for select/multiselect type */}
            {(newType === 'select' || newType === 'multiselect') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Options</label>
                <div className="flex gap-2">
                  <Input
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    placeholder="Add option..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                  />
                  <Button type="button" variant="outline" onClick={handleAddOption}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newOptions.map((opt, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {opt.label}
                      <button onClick={() => handleRemoveOption(index)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Note for user type */}
            {newType === 'user' && (
              <p className="text-xs text-muted-foreground">
                Allows selecting team members from the workspace
              </p>
            )}

            {/* Note for file type */}
            {newType === 'file' && (
              <p className="text-xs text-muted-foreground">
                Allows attaching files to tasks (uses URL for now)
              </p>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="new-required"
                checked={newRequired}
                onCheckedChange={(checked) => setNewRequired(!!checked)}
              />
              <label htmlFor="new-required" className="text-sm">
                Required field
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} size="sm" className="gap-2">
                <Check className="h-4 w-4" />
                Add Field
              </Button>
              <Button
                onClick={() => setIsAdding(false)}
                variant="ghost"
                size="sm"
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fields list */}
      <div className="space-y-2">
        {fields.map((field) => {
          const Icon = getFieldIcon(field.field_type);
          
          return (
            <Card key={field.id} className="group">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{field.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {FIELD_TYPES.find(t => t.value === field.field_type)?.label}
                      </Badge>
                      {field.is_required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                      {(field.field_type === 'select' || field.field_type === 'multiselect') && field.options.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {field.options.length} options
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {fields.length === 0 && !isAdding && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No custom fields defined</p>
          <p className="text-sm">Click "Add Field" to create custom task fields</p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this field? All values for this field will be permanently deleted.
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
    </div>
  );
}

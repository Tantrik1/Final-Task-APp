import { useState } from 'react';
import { useProjectStatuses, ProjectStatus } from '@/hooks/useProjectStatuses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
} from '@/components/ui/alert-dialog';
import {
  Plus,
  GripVertical,
  Trash2,
  Edit2,
  Check,
  X,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#94a3b8', '#f97316', '#8b5cf6', '#22c55e', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
];

interface StatusManagerProps {
  projectId: string;
}

export function StatusManager({ projectId }: StatusManagerProps) {
  const {
    statuses,
    isLoading,
    createStatus,
    updateStatus,
    deleteStatus,
  } = useProjectStatuses(projectId);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newIsCompleted, setNewIsCompleted] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    
    await createStatus({
      name: newName.trim(),
      color: newColor,
      is_completed: newIsCompleted,
    });

    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    setNewIsCompleted(false);
    setIsAdding(false);
  };

  const handleStartEdit = (status: ProjectStatus) => {
    setEditingId(status.id);
    setEditName(status.name);
    setEditColor(status.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    await updateStatus(editingId, {
      name: editName.trim(),
      color: editColor,
    });

    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteStatus(deleteId);
    setDeleteId(null);
  };

  const handleSetDefault = async (id: string) => {
    // First unset all defaults
    for (const status of statuses) {
      if (status.is_default) {
        await updateStatus(status.id, { is_default: false });
      }
    }
    await updateStatus(id, { is_default: true });
  };

  const handleToggleCompleted = async (id: string, current: boolean) => {
    // If setting to completed, unset other completed statuses
    if (!current) {
      for (const status of statuses) {
        if (status.is_completed) {
          await updateStatus(status.id, { is_completed: false });
        }
      }
    }
    await updateStatus(id, { is_completed: !current });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Workflow Statuses</h3>
          <p className="text-sm text-muted-foreground">
            Define custom workflow stages for tasks
          </p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Status
          </Button>
        )}
      </div>

      {/* Add new status form */}
      {isAdding && (
        <Card className="border-dashed border-2">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Status name"
                className="flex-1"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Color:</span>
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform',
                    newColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="new-completed"
                checked={newIsCompleted}
                onCheckedChange={(checked) => setNewIsCompleted(!!checked)}
              />
              <label htmlFor="new-completed" className="text-sm">
                Mark tasks as completed when moved to this status
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} size="sm" className="gap-2">
                <Check className="h-4 w-4" />
                Add
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

      {/* Status list */}
      <div className="space-y-2">
        {statuses.map((status, index) => (
          <Card key={status.id} className="group">
            <CardContent className="p-3">
              {editingId === status.id ? (
                <div className="space-y-3">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={cn(
                          'h-6 w-6 rounded-full transition-transform',
                          editColor === color && 'ring-2 ring-offset-2 ring-primary scale-110'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} size="sm">Save</Button>
                    <Button onClick={() => setEditingId(null)} variant="ghost" size="sm">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
                  <div
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  
                  <span className="font-medium flex-1">{status.name}</span>

                  <div className="flex items-center gap-1">
                    {status.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                    {status.is_completed && (
                      <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!status.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSetDefault(status.id)}
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleCompleted(status.id, status.is_completed)}
                      title={status.is_completed ? 'Unmark as complete status' : 'Mark as complete status'}
                    >
                      <CheckCircle2 className={cn(
                        "h-4 w-4",
                        status.is_completed && "text-success"
                      )} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleStartEdit(status)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(status.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {statuses.length === 0 && !isAdding && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No custom statuses defined</p>
          <p className="text-sm">Click "Add Status" to create workflow stages</p>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this status? Tasks using this status will need to be reassigned.
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

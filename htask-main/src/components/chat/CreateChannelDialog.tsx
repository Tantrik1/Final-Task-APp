import { useState } from 'react';
import { Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Channel } from '@/hooks/useChat';

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChannel: (name: string, description?: string) => Promise<Channel | null>;
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreateChannel,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    const channel = await onCreateChannel(name.trim(), description.trim() || undefined);

    if (channel) {
      setName('');
      setDescription('');
      onOpenChange(false);
    } else {
      setError('Failed to create channel. Please try again.');
    }

    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hash className="h-4 w-4 text-primary" />
            </div>
            Create a channel
          </DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They're best organized around a topic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  setError('');
                }}
                placeholder="e.g. design-team"
                className="pl-9 rounded-xl"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">
              Description <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="rounded-xl"
          >
            {isCreating ? 'Creating...' : 'Create Channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

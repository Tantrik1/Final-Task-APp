import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { User, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  full_name: string | null;
  email: string;
}

interface AssigneePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function AssigneePicker({ value, onChange }: AssigneePickerProps) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!workspaceId) return;

      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select(`
            user_id,
            profiles!workspace_members_user_id_fkey(id, full_name, email)
          `)
          .eq('workspace_id', workspaceId);

        if (error) throw error;

        const membersList = (data || [])
          .filter((m: any) => m.profiles)
          .map((m: any) => ({
            id: m.profiles.id,
            full_name: m.profiles.full_name,
            email: m.profiles.email,
          }));

        setMembers(membersList);

        // Find selected member
        if (value) {
          const selected = membersList.find((m) => m.id === value);
          setSelectedMember(selected || null);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [workspaceId, value]);

  const getInitials = (member: Member) => {
    if (member.full_name) {
      return member.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return member.email[0].toUpperCase();
  };

  const handleSelect = (memberId: string) => {
    if (memberId === value) {
      // Deselect
      onChange(null);
      setSelectedMember(null);
    } else {
      onChange(memberId);
      const member = members.find((m) => m.id === memberId);
      setSelectedMember(member || null);
    }
    setOpen(false);
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start"
        >
          {selectedMember ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                  {getInitials(selectedMember)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {selectedMember.full_name || selectedMember.email.split('@')[0]}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Assign to...</span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search members..." />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  onSelect={() => handleSelect('')}
                  className="text-muted-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove assignee
                </CommandItem>
              )}
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.full_name || member.email}
                  onSelect={() => handleSelect(member.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === member.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                      {getInitials(member)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.full_name || member.email.split('@')[0]}
                    </p>
                    {member.full_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

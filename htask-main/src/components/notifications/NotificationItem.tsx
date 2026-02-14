import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  CheckSquare,
  MessageSquare,
  FolderKanban,
  UserPlus,
  Clock,
  Bell,
  ArrowRight,
  X,
  Users,
  Hash,
  Edit,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
  isInSheet?: boolean;
}

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; bgColor: string }> = {
  task_assigned: { icon: CheckSquare, color: 'text-primary', bgColor: 'bg-primary/10' },
  task_status_changed: { icon: ArrowRight, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  task_completed: { icon: CheckSquare, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  task_updated: { icon: Edit, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  task_due_soon: { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  task_overdue: { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  comment_added: { icon: MessageSquare, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  comment_reply: { icon: MessageSquare, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  project_created: { icon: FolderKanban, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  project_updated: { icon: FolderKanban, color: 'text-teal-500', bgColor: 'bg-teal-500/10' },
  member_joined: { icon: UserPlus, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
  member_invited: { icon: UserPlus, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  workspace_invite_accepted: { icon: UserPlus, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  role_changed: { icon: ShieldCheck, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  chat_mention: { icon: MessageSquare, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  due_date_reminder: { icon: Clock, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
};

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
  isInSheet,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const { workspaceId: currentWorkspaceId } = useParams<{ workspaceId: string }>();
  const config = typeConfig[notification.type] || { icon: Bell, color: 'text-muted-foreground', bgColor: 'bg-muted' };
  const Icon = config.icon;

  const getNavigationPath = (): string | null => {
    const targetWorkspaceId = notification.workspace_id;
    const metadata = notification.metadata as Record<string, any>;

    switch (notification.entity_type) {
      case 'task': {
        const projectId = metadata?.project_id;
        if (projectId && targetWorkspaceId) {
          return `/workspace/${targetWorkspaceId}/projects/${projectId}/tasks/${notification.entity_id}`;
        }
        return null;
      }
      case 'project':
        if (targetWorkspaceId) {
          return `/workspace/${targetWorkspaceId}/projects/${notification.entity_id}`;
        }
        return null;
      case 'comment': {
        const projectId = metadata?.project_id;
        const taskId = metadata?.task_id;
        if (projectId && taskId && targetWorkspaceId) {
          return `/workspace/${targetWorkspaceId}/projects/${projectId}/tasks/${taskId}`;
        }
        return null;
      }
      case 'chat': {
        if (metadata?.is_dm && metadata?.conversation_id) {
          return `/workspace/${targetWorkspaceId}/chat?dm=${metadata.conversation_id}`;
        }
        if (metadata?.channel_id) {
          return `/workspace/${targetWorkspaceId}/chat?channel=${metadata.channel_id}`;
        }
        return `/workspace/${targetWorkspaceId}/chat`;
      }
      case 'workspace':
        return `/workspace/${targetWorkspaceId}/members`;
      default:
        return null;
    }
  };

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }

    const path = getNavigationPath();
    if (path) {
      navigate(path);
      onClose?.();
    }
  };

  // Get actor display name
  const actorName = notification.actor?.full_name || notification.actor?.email?.split('@')[0] || 'Someone';
  const navigationPath = getNavigationPath();
  const isClickable = !!navigationPath;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        'group relative flex items-start gap-3 p-4 rounded-2xl transition-all duration-300',
        isClickable && 'cursor-pointer',
        notification.is_read
          ? 'bg-background/50 hover:bg-muted/50'
          : 'bg-gradient-to-r from-primary/5 via-transparent to-transparent border-l-2 border-primary hover:from-primary/10'
      )}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleClick() : undefined}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center', config.bgColor)}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium truncate',
              !notification.is_read && 'text-foreground'
            )}>
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {notification.body}
            </p>
          </div>

          {/* Actor Avatar */}
          {notification.actor && (
            <Avatar className="h-8 w-8 ring-2 ring-background flex-shrink-0">
              <AvatarImage src={notification.actor.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-accent text-primary-foreground">
                {actorName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1.5">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
    </motion.div>
  );
}

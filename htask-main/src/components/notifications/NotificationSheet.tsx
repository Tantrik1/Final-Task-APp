import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, CheckCheck, Inbox, MessageSquare, CheckSquare, FolderKanban } from 'lucide-react';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

interface NotificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

type FilterType = 'all' | 'unread' | 'tasks' | 'comments' | 'projects';

export function NotificationSheet({
  open,
  onOpenChange,
  notifications,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
}: NotificationSheetProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    switch (filter) {
      case 'unread':
        return !n.is_read;
      case 'tasks':
        return ['task_assigned', 'task_status_changed', 'task_completed'].includes(n.type);
      case 'comments':
        return ['comment_added', 'comment_reply'].includes(n.type);
      case 'projects':
        return ['project_created', 'project_updated'].includes(n.type);
      default:
        return true;
    }
  });

  // Group by date
  const grouped = filteredNotifications.reduce((acc, notification) => {
    const date = parseISO(notification.created_at);
    let group = 'Older';
    
    if (isToday(date)) {
      group = 'Today';
    } else if (isYesterday(date)) {
      group = 'Yesterday';
    } else if (isThisWeek(date)) {
      group = 'This Week';
    }
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(notification);
    return acc;
  }, {} as Record<string, Notification[]>);

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filterTabs = [
    { value: 'all', label: 'All', icon: Inbox },
    { value: 'unread', label: 'Unread', icon: Bell, count: unreadCount },
    { value: 'tasks', label: 'Tasks', icon: CheckSquare },
    { value: 'comments', label: 'Comments', icon: MessageSquare },
    { value: 'projects', label: 'Projects', icon: FolderKanban },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col gap-0 bg-gradient-to-b from-background via-background to-muted/20"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-background/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary-foreground" />
              </div>
              Notifications
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMarkAllAsRead}
                className="text-primary hover:text-primary/80 gap-1.5"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="mt-4">
            <TabsList className="w-full h-auto p-1 bg-muted/50 rounded-xl grid grid-cols-5 gap-1">
              {filterTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    'rounded-lg py-2 px-2 text-xs font-medium transition-all',
                    'data-[state=active]:bg-background data-[state=active]:shadow-sm'
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {isLoading ? (
              // Loading skeletons
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-2xl bg-muted/30">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              // Empty state
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                  <Bell className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-lg font-semibold mb-1">All caught up!</h3>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  {filter === 'unread'
                    ? "You've read all your notifications"
                    : 'No notifications to show here'}
                </p>
              </motion.div>
            ) : (
              // Grouped notifications
              <AnimatePresence mode="popLayout">
                {groupOrder.map((group) => {
                  const items = grouped[group];
                  if (!items || items.length === 0) return null;

                  return (
                    <motion.div
                      key={group}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2 px-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group}
                        </h3>
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-xs text-muted-foreground/70">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <AnimatePresence mode="popLayout">
                          {items.map((notification) => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                              onMarkAsRead={onMarkAsRead}
                              onDelete={onDelete}
                              onClose={() => onOpenChange(false)}
                              isInSheet={true}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

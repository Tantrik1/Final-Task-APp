import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, CheckCheck, Inbox, MessageSquare, CheckSquare, FolderKanban,
  Settings, BellOff, Users, MessageCircle
} from 'lucide-react';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

type FilterType = 'all' | 'unread' | 'tasks' | 'comments' | 'chat' | 'projects' | 'members';

export default function WorkspaceNotifications() {
  const {
    notifications,
    isLoading,
    unreadCount,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
  } = useNotifications();
  
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<FilterType>('all');
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    switch (filter) {
      case 'unread':
        return !n.is_read;
      case 'tasks':
        return ['task_assigned', 'task_status_changed', 'task_completed', 'due_date_reminder'].includes(n.type);
      case 'comments':
        return ['comment_added', 'comment_reply'].includes(n.type);
      case 'chat':
        return ['chat_mention'].includes(n.type);
      case 'projects':
        return ['project_created', 'project_updated'].includes(n.type);
      case 'members':
        return ['member_joined', 'member_invited'].includes(n.type);
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

  const filterTabs = [
    { value: 'all', label: 'All', icon: Inbox },
    { value: 'unread', label: 'Unread', icon: Bell, count: unreadCount },
    { value: 'tasks', label: 'Tasks', icon: CheckSquare },
    { value: 'comments', label: 'Comments', icon: MessageSquare },
    { value: 'chat', label: 'Chat', icon: MessageCircle },
    { value: 'projects', label: 'Projects', icon: FolderKanban },
    { value: 'members', label: 'Members', icon: Users },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-6 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary-foreground" />
            </div>
            Notifications
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Stay updated with your workspace activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="rounded-xl gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          )}
          <Sheet open={preferencesOpen} onOpenChange={setPreferencesOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Notification Settings</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-100px)] pr-4">
                <NotificationPreferences />
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="rounded-xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{notifications.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{unreadCount}</p>
            <p className="text-xs text-muted-foreground">Unread</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {notifications.filter(n => ['task_assigned', 'task_status_changed', 'task_completed'].includes(n.type)).length}
            </p>
            <p className="text-xs text-muted-foreground">Tasks</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {notifications.filter(n => ['comment_added', 'comment_reply'].includes(n.type)).length}
            </p>
            <p className="text-xs text-muted-foreground">Comments</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="pb-0 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              Activity Feed
              {unreadCount > 0 && (
                <Badge className="bg-primary/20 text-primary px-2 py-0.5 text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </CardTitle>
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full">
            {isMobile ? (
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-max h-auto p-1 bg-muted/50 rounded-xl gap-1">
                  {filterTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap"
                    >
                      <tab.icon className="h-3.5 w-3.5 mr-1.5" />
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] rounded-md">
                          {tab.count}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
                {filterTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <tab.icon className="h-4 w-4 mr-2" />
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs rounded-md">
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
          </Tabs>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                {filter === 'unread' ? (
                  <CheckCheck className="h-10 w-10 text-muted-foreground/50" />
                ) : (
                  <BellOff className="h-10 w-10 text-muted-foreground/50" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {filter === 'unread' ? 'All caught up!' : 'No notifications'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                {filter === 'unread'
                  ? "You've read all your notifications. Great job staying on top of things!"
                  : filter === 'all'
                  ? 'No notifications yet. Activity from your workspace will appear here.'
                  : `No ${filter} notifications to show.`}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-6">
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
                              onMarkAsRead={markAsRead}
                              onDelete={deleteNotification}
                              isInSheet={false}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

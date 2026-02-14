import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationSheet } from './NotificationSheet';
import { useNotifications } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const isMobile = useIsMobile();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasNewNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleClick = () => {
    // On mobile, navigate to page; on desktop, open sheet
    if (isMobile && workspaceId) {
      navigate(`/workspace/${workspaceId}/notifications`);
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'relative h-10 w-10 rounded-xl transition-all duration-300',
          'hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10',
          unreadCount > 0 && 'ring-2 ring-primary/20'
        )}
        onClick={handleClick}
      >
        <motion.div
          animate={hasNewNotification ? { rotate: [0, -15, 15, -15, 15, 0] } : {}}
          transition={{ duration: 0.5 }}
        >
          <Bell className={cn(
            'h-5 w-5 transition-colors',
            unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'
          )} />
        </motion.div>

        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1"
            >
              <motion.span
                animate={hasNewNotification ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={cn(
                  'flex items-center justify-center min-w-[20px] h-5 px-1.5',
                  'text-[10px] font-bold text-primary-foreground',
                  'bg-gradient-to-r from-primary to-accent rounded-full',
                  'shadow-lg shadow-primary/30'
                )}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse glow effect */}
        {unreadCount > 0 && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-primary/20"
            animate={{ opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </Button>

      <NotificationSheet
        open={open}
        onOpenChange={setOpen}
        notifications={notifications}
        isLoading={isLoading}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
      />
    </>
  );
}

import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  FolderKanban, 
  CheckSquare, 
  MessageCircle, 
  Menu,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/useChat';

interface NavItem {
  icon: typeof Menu;
  label: string;
  path: string;
  glow?: boolean;
}

export function BottomNav() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { totalUnreadCount } = useChat(workspaceId);

  const navItems: NavItem[] = [
    { icon: Menu, label: 'Menu', path: '/menu' },
    { icon: LayoutDashboard, label: 'Home', path: '' },
    { icon: CheckSquare, label: 'Tasks', path: '/my-tasks', glow: true },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: MessageCircle, label: 'Chat', path: '/chat' },
  ];

  const isActive = (path: string) => {
    if (path === '') {
      return location.pathname === `/workspace/${workspaceId}`;
    }
    return location.pathname === `/workspace/${workspaceId}${path}`;
  };

  const handleNavClick = (item: NavItem) => {
    navigate(`/workspace/${workspaceId}${item.path}`);
  };

  return (
    <>
      {/* Fixed Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/85 backdrop-blur-lg border-t border-border/50 pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const isMenu = item.path === 'menu';
            
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 min-w-[56px]',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {/* Active background with glow for Tasks */}
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className={cn(
                      'absolute inset-0 rounded-xl',
                      item.glow 
                        ? 'bg-gradient-to-t from-primary/20 to-primary/5 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
                        : 'bg-primary/10'
                    )}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                {/* Glow effect for Tasks tab even when not active */}
                {item.glow && !active && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-primary/5 to-transparent" />
                )}

                <div className="relative z-10 flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <item.icon className={cn(
                      'h-5 w-5 transition-transform',
                      active && 'scale-110',
                      item.glow && 'text-primary'
                    )} />
                    {item.path === '/chat' && totalUnreadCount > 0 && (
                      <Badge 
                        className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 text-[9px] font-bold bg-primary text-primary-foreground border-0"
                      >
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </Badge>
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium',
                    active && 'font-semibold',
                    item.glow && 'text-primary'
                  )}>
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

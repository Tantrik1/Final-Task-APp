import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Calendar,
  MessageCircle,
  Users,
  CreditCard,
  Settings,
  User,
  LogOut,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useChat } from '@/hooks/useChat';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  path: string;
  color: string;
  badge?: number;
}

export default function WorkspaceMenu() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { currentRole } = useWorkspace();
  const { totalUnreadCount } = useChat(workspaceId);

  const canSeeAdminItems = currentRole === 'owner' || currentRole === 'admin';

  const mainItems: MenuItem[] = [
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      description: 'Overview & analytics',
      path: '',
      color: 'from-blue-500/20 to-blue-600/10',
    },
    {
      icon: FolderKanban,
      label: 'Projects',
      description: 'Manage all projects',
      path: '/projects',
      color: 'from-violet-500/20 to-violet-600/10',
    },
    {
      icon: CheckSquare,
      label: 'My Tasks',
      description: 'Your assigned tasks',
      path: '/my-tasks',
      color: 'from-emerald-500/20 to-emerald-600/10',
    },
    {
      icon: Calendar,
      label: 'Calendar',
      description: 'Schedule & deadlines',
      path: '/calendar',
      color: 'from-orange-500/20 to-orange-600/10',
    },
    {
      icon: MessageCircle,
      label: 'Chat',
      description: 'Team conversations',
      path: '/chat',
      color: 'from-pink-500/20 to-pink-600/10',
      badge: totalUnreadCount,
    },
  ];

  const managementItems: MenuItem[] = [
    {
      icon: Users,
      label: 'Members',
      description: 'Invite & manage team',
      path: '/members',
      color: 'from-cyan-500/20 to-cyan-600/10',
    },
    {
      icon: CreditCard,
      label: 'Billing',
      description: 'Plans & payments',
      path: '/billing',
      color: 'from-amber-500/20 to-amber-600/10',
    },
    {
      icon: Settings,
      label: 'Settings',
      description: 'Workspace preferences',
      path: '/settings',
      color: 'from-slate-500/20 to-slate-600/10',
    },
  ];

  const accountItems: MenuItem[] = [
    {
      icon: User,
      label: 'Profile',
      description: 'Your account details',
      path: '/profile',
      color: 'from-indigo-500/20 to-indigo-600/10',
    },
  ];

  const handleNavigate = (path: string) => {
    navigate(`/workspace/${workspaceId}${path}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  const MenuCard = ({ menuItem }: { menuItem: MenuItem }) => (
    <motion.div variants={item}>
      <Card
        onClick={() => handleNavigate(menuItem.path)}
        className="relative overflow-hidden border-border/40 bg-card/80 backdrop-blur-sm hover:bg-card hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer rounded-2xl"
      >
        <div className="flex items-center gap-3 p-4">
          <div className={cn(
            'h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0',
            menuItem.color
          )}>
            <menuItem.icon className="h-5 w-5 text-foreground/80" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{menuItem.label}</p>
            <p className="text-xs text-muted-foreground">{menuItem.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {menuItem.badge && menuItem.badge > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 h-5">
                {menuItem.badge > 99 ? '99+' : menuItem.badge}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="p-4 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold">Menu</h1>
        <p className="text-sm text-muted-foreground">Quick access to all features</p>
      </div>

      {/* Main Features */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Features
        </p>
        {mainItems.map((mi) => (
          <MenuCard key={mi.path} menuItem={mi} />
        ))}
      </motion.div>

      {/* Management - Owner/Admin Only */}
      {canSeeAdminItems && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Management
          </p>
          {managementItems.map((mi) => (
            <MenuCard key={mi.path} menuItem={mi} />
          ))}
        </motion.div>
      )}

      {/* Subscription Card - Owner/Admin Only */}
      {canSeeAdminItems && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Subscription
          </p>
          <SubscriptionCard variant="expanded" />
        </div>
      )}

      {/* Account */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-2"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
          Account
        </p>
        {accountItems.map((mi) => (
          <MenuCard key={mi.path} menuItem={mi} />
        ))}

        {/* Sign Out */}
        <motion.div variants={item}>
          <Card
            onClick={handleSignOut}
            className="border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer rounded-2xl"
          >
            <div className="flex items-center gap-3 p-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center shrink-0">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-destructive">Sign Out</p>
                <p className="text-xs text-muted-foreground">Log out of your account</p>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive/40" />
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

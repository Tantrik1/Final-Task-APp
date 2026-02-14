import { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Building2,
  Calendar,
  User,
  Target,
  MessageCircle,
  CreditCard,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SubscriptionBanner } from '@/components/subscription/SubscriptionBanner';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { useChat } from '@/hooks/useChat';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, useSidebarState } from '@/hooks/useSidebarState';

function WorkspaceLayoutContent() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, currentRole, isLoading, setCurrentWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed, isMobileOpen, setIsMobileOpen, toggle } = useSidebarState();
  const { totalUnreadCount } = useChat(workspaceId);
  const { unreadCount: notificationUnreadCount } = useNotifications();

  // Sync URL workspace with context
  useEffect(() => {
    if (workspaceId && workspaces.length > 0) {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        setCurrentWorkspaceId(workspaceId);
      } else {
        navigate(`/workspace/${workspaces[0].id}`);
      }
    }
  }, [workspaceId, workspaces, setCurrentWorkspaceId, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleWorkspaceSwitch = (id: string) => {
    setCurrentWorkspaceId(id);
    navigate(`/workspace/${id}`);
  };

  const mainNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '' },
    { icon: FolderKanban, label: 'Projects', path: '/projects' },
    { icon: Target, label: 'My Tasks', path: '/my-tasks' },
    { icon: MessageCircle, label: 'Chat', path: '/chat', badge: totalUnreadCount },
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badge: notificationUnreadCount },
  ];

  const bottomNavItems = [
    { icon: Users, label: 'Members', path: '/members', roles: ['owner', 'admin'] },
    { icon: CreditCard, label: 'Billing', path: '/billing', roles: ['owner', 'admin'] },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['owner', 'admin'] },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path: string) => {
    const fullPath = `/workspace/${workspaceId}${path}`;
    return location.pathname === fullPath || (path === '' && location.pathname === `/workspace/${workspaceId}`);
  };

  const filterByRole = (items: typeof bottomNavItems) => 
    items.filter((item) => !item.roles || (currentRole && item.roles.includes(currentRole)));

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 72 },
  };

  const labelVariants = {
    visible: { opacity: 1, x: 0, display: 'block' },
    hidden: { opacity: 0, x: -10, transitionEnd: { display: 'none' } },
  };

  // Workspace logo component
  const WorkspaceLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    };
    const iconSizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    if (currentWorkspace?.logo_url) {
      return (
        <Avatar className={cn(sizeClasses[size], 'rounded-xl')}>
          <AvatarImage src={currentWorkspace.logo_url} alt={currentWorkspace.name} className="object-cover" />
          <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
            <Building2 className={iconSizes[size]} />
          </AvatarFallback>
        </Avatar>
      );
    }

    return (
      <div className={cn(
        sizeClasses[size],
        'rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shrink-0'
      )}>
        <Building2 className={cn(iconSizes[size], 'text-primary')} />
      </div>
    );
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Workspace Header with Logo */}
      <div className={cn(
        "border-b transition-all duration-300",
        isCollapsed && !isMobile ? "p-2" : "px-3 py-4"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full h-auto rounded-xl hover:bg-primary/5 transition-all duration-300",
                isCollapsed && !isMobile ? "p-2 justify-center" : "py-3 px-3 justify-between"
              )}
            >
              <div className={cn(
                "flex items-center gap-3",
                isCollapsed && !isMobile && "justify-center"
              )}>
                <WorkspaceLogo size={isCollapsed && !isMobile ? 'sm' : 'md'} />
                <AnimatePresence mode="wait">
                  {(!isCollapsed || isMobile) && (
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      variants={labelVariants}
                      transition={{ duration: 0.15 }}
                      className="text-left"
                    >
                      {isLoading ? (
                        <Skeleton className="h-4 w-24" />
                      ) : (
                        <>
                          <p className="font-semibold text-sm truncate max-w-[130px]">
                            {currentWorkspace?.name || 'Select Workspace'}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{currentRole}</p>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait">
                {(!isCollapsed || isMobile) && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={labelVariants}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-xl">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceSwitch(workspace.id)}
                className={cn(
                  'cursor-pointer rounded-lg',
                  workspace.id === currentWorkspace?.id && 'bg-primary/10'
                )}
              >
                <Building2 className="h-4 w-4 mr-2" />
                <span className="truncate">{workspace.name}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {workspace.role}
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/onboarding')} className="cursor-pointer rounded-lg">
              <Plus className="h-4 w-4 mr-2" />
              Create New Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation */}
      <ScrollArea className="flex-1 py-4">
        <TooltipProvider delayDuration={0}>
          <nav className={cn(
            "space-y-1 transition-all duration-300",
            isCollapsed && !isMobile ? "px-2" : "px-3"
          )}>
            <AnimatePresence mode="wait">
              {(!isCollapsed || isMobile) && (
                <motion.p
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={labelVariants}
                  transition={{ duration: 0.15 }}
                  className="text-xs font-semibold text-muted-foreground px-3 mb-2"
                >
                  MAIN
                </motion.p>
              )}
            </AnimatePresence>

            {mainNavItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/workspace/${workspaceId}${item.path}`}
                    onClick={() => isMobile && setIsMobileOpen(false)}
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        'w-full gap-3 rounded-xl h-11 font-medium transition-all duration-200',
                        isCollapsed && !isMobile ? 'justify-center px-0' : 'justify-start',
                        isActive(item.path) 
                          ? 'bg-primary/10 text-primary hover:bg-primary/15' 
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="relative shrink-0">
                        <item.icon className={cn('h-5 w-5', isActive(item.path) && 'text-primary')} />
                        {item.badge && item.badge > 0 && (
                          <Badge 
                            className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 text-[9px] font-bold bg-primary text-primary-foreground"
                          >
                            {item.badge > 99 ? '99+' : item.badge}
                          </Badge>
                        )}
                      </div>
                      <AnimatePresence mode="wait">
                        {(!isCollapsed || isMobile) && (
                          <motion.span
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            variants={labelVariants}
                            transition={{ duration: 0.15 }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && !isMobile && (
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}

            {/* Subscription Section - Owner/Admin Only */}
            {(currentRole === 'owner' || currentRole === 'admin') && (!isCollapsed || isMobile) && (
              <div className="pt-4">
                <p className="text-xs font-semibold text-muted-foreground px-3 mb-2">SUBSCRIPTION</p>
                <SubscriptionCard variant="compact" />
              </div>
            )}

            <div className="pt-4">
              <AnimatePresence mode="wait">
                {(!isCollapsed || isMobile) && (
                  <motion.p
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={labelVariants}
                    transition={{ duration: 0.15 }}
                    className="text-xs font-semibold text-muted-foreground px-3 mb-2"
                  >
                    SETTINGS
                  </motion.p>
                )}
              </AnimatePresence>
              {filterByRole(bottomNavItems).map((item) => (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/workspace/${workspaceId}${item.path}`}
                      onClick={() => isMobile && setIsMobileOpen(false)}
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          'w-full gap-3 rounded-xl h-11 font-medium transition-all duration-200',
                          isCollapsed && !isMobile ? 'justify-center px-0' : 'justify-start',
                          isActive(item.path) 
                            ? 'bg-primary/10 text-primary hover:bg-primary/15' 
                            : 'hover:bg-muted/50'
                        )}
                      >
                        <item.icon className={cn('h-5 w-5 shrink-0', isActive(item.path) && 'text-primary')} />
                        <AnimatePresence mode="wait">
                          {(!isCollapsed || isMobile) && (
                            <motion.span
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              variants={labelVariants}
                              transition={{ duration: 0.15 }}
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  {isCollapsed && !isMobile && (
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>
          </nav>
        </TooltipProvider>
      </ScrollArea>

      {/* User Section */}
      <div className={cn(
        "border-t transition-all duration-300",
        isCollapsed && !isMobile ? "p-2" : "p-3"
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full gap-3 h-auto rounded-xl hover:bg-muted/50 transition-all duration-300",
                isCollapsed && !isMobile ? "p-2 justify-center" : "py-3 justify-start"
              )}
            >
              <Avatar className={cn("shrink-0", isCollapsed && !isMobile ? "h-8 w-8" : "h-9 w-9")}>
                <AvatarImage src={undefined} alt={user?.email || 'User'} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <AnimatePresence mode="wait">
                {(!isCollapsed || isMobile) && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={labelVariants}
                    transition={{ duration: 0.15 }}
                    className="text-left flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium truncate">{user?.email?.split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Account</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive rounded-lg">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Collapse Toggle - Desktop only */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "w-full h-10 rounded-xl mt-2 transition-all duration-300 border border-border/50",
              isCollapsed ? "justify-center" : "justify-start gap-2"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-muted-foreground">Collapse</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex w-full overflow-hidden">
      {/* Desktop Sidebar - Fixed/Sticky */}
      <motion.aside
        initial={false}
        animate={isCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col border-r shrink-0 h-screen sticky top-0 overflow-hidden"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-80">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - Sticky within content */}
        <header className="shrink-0 border-b bg-background/80 backdrop-blur-lg z-40">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            {/* Mobile Menu */}
            <div className="flex items-center gap-3 lg:hidden">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-xl"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Link to={`/workspace/${workspaceId}`} className="flex items-center gap-2">
                <WorkspaceLogo size="sm" />
                <span className="font-semibold text-sm truncate max-w-[120px]">
                  {currentWorkspace?.name}
                </span>
              </Link>
            </div>

            {/* Desktop breadcrumb / search could go here */}
            <div className="hidden lg:block flex-1" />

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-xl">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={undefined} alt={user?.email || 'User'} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Account</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive rounded-lg">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Subscription Banner */}
        <SubscriptionBanner />

        {/* Page Content - Scrollable Area */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function WorkspaceLayout() {
  return (
    <SidebarProvider>
      <WorkspaceLayoutContent />
    </SidebarProvider>
  );
}

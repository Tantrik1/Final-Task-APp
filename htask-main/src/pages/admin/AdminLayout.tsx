import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  CreditCard, 
  Building2, 
  Receipt, 
  ToggleLeft, 
  FolderKanban,
  QrCode,
  Shield,
  LogOut,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, useSidebarState } from '@/hooks/useSidebarState';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/plans', icon: CreditCard, label: 'Plans' },
  { to: '/admin/workspaces', icon: Building2, label: 'Workspaces' },
  { to: '/admin/payments', icon: Receipt, label: 'Payments' },
  { to: '/admin/payment-methods', icon: QrCode, label: 'Payment Methods' },
  { to: '/admin/feature-flags', icon: ToggleLeft, label: 'Feature Flags' },
  { to: '/admin/templates', icon: FolderKanban, label: 'Templates' },
  { to: '/admin/pages', icon: FileText, label: 'Site Pages' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

function AdminSidebar() {
  const { isCollapsed, isMobileOpen, setIsMobileOpen, toggle } = useSidebarState();
  const { signOut } = useAuth();

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 72 },
  };

  const labelVariants = {
    visible: { opacity: 1, x: 0, display: 'block' },
    hidden: { opacity: 0, x: -10, transitionEnd: { display: 'none' } },
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header */}
      <div className={cn(
        "h-16 border-b flex items-center transition-all duration-300",
        isCollapsed && !isMobile ? "justify-center px-2" : "px-4 gap-3"
      )}>
        <div className={cn(
          "h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0",
          isCollapsed && !isMobile && "h-10 w-10"
        )}>
          <Shield className="h-5 w-5 text-primary" />
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
              <h1 className="font-bold text-sm">Super Admin</h1>
              <p className="text-xs text-muted-foreground">Control Panel</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <TooltipProvider delayDuration={0}>
          <nav className={cn(
            "space-y-1 transition-all duration-300",
            isCollapsed && !isMobile ? "px-2" : "px-3"
          )}>
            {navItems.map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => isMobile && setIsMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                        isCollapsed && !isMobile 
                          ? 'h-11 w-11 justify-center mx-auto' 
                          : 'h-11 px-3',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <AnimatePresence mode="wait">
                      {(!isCollapsed || isMobile) && (
                        <motion.span
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                          variants={labelVariants}
                          transition={{ duration: 0.15 }}
                          className="truncate"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                </TooltipTrigger>
                {isCollapsed && !isMobile && (
                  <TooltipContent side="right" sideOffset={8} className="font-medium">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>

      {/* Footer */}
      <div className={cn(
        "border-t space-y-2 transition-all duration-300",
        isCollapsed && !isMobile ? "p-2" : "p-4"
      )}>
        {/* Back to App */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              to="/" 
              className={cn(
                "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl p-2 hover:bg-muted/50",
                isCollapsed && !isMobile && "justify-center"
              )}
            >
              <img src={logoDark} alt="Logo" className="h-5 dark:hidden shrink-0" />
              <img src={logoLight} alt="Logo" className="h-5 hidden dark:block shrink-0" />
              <AnimatePresence mode="wait">
                {(!isCollapsed || isMobile) && (
                  <motion.span
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={labelVariants}
                    transition={{ duration: 0.15 }}
                  >
                    Back to App
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </TooltipTrigger>
          {isCollapsed && !isMobile && (
            <TooltipContent side="right" sideOffset={8}>
              Back to App
            </TooltipContent>
          )}
        </Tooltip>

        {/* Sign Out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full text-muted-foreground rounded-xl transition-all duration-300",
                isCollapsed && !isMobile ? "justify-center px-0" : "justify-start"
              )}
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <AnimatePresence mode="wait">
                {(!isCollapsed || isMobile) && (
                  <motion.span
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={labelVariants}
                    transition={{ duration: 0.15 }}
                    className="ml-2"
                  >
                    Sign Out
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </TooltipTrigger>
          {isCollapsed && !isMobile && (
            <TooltipContent side="right" sideOffset={8}>
              Sign Out
            </TooltipContent>
          )}
        </Tooltip>

        {/* Collapse Toggle - Desktop only */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "w-full h-10 rounded-xl transition-all duration-300 border border-border/50",
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

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={isCollapsed ? 'collapsed' : 'expanded'}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden md:flex flex-col border-r shrink-0 bg-sidebar"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>
    </>
  );
}

function AdminLayoutContent() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const { isCollapsed, setIsMobileOpen } = useSidebarState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate('/', { replace: true });
    }
  }, [loading, isSuperAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 border-b bg-background/95 backdrop-blur-md z-50 flex items-center px-4 gap-3 h-14 pt-safe">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(true)}
            className="rounded-xl"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold">Super Admin</span>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="md:hidden h-14 pt-safe" /> {/* Spacer for mobile header */}
          <div className="p-4 sm:p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <AdminLayoutContent />
    </SidebarProvider>
  );
}

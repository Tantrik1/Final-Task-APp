import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useSidebarState } from '@/hooks/useSidebarState';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  end?: boolean;
  badge?: ReactNode;
}

interface CollapsibleSidebarProps {
  header: ReactNode;
  navItems: NavItem[];
  footer?: ReactNode;
  mobileTitle?: string;
}

export function CollapsibleSidebar({
  header,
  navItems,
  footer,
  mobileTitle = 'Menu',
}: CollapsibleSidebarProps) {
  const { isCollapsed, isMobileOpen, setIsCollapsed, setIsMobileOpen, toggle } = useSidebarState();

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 72 },
  };

  const labelVariants = {
    visible: { opacity: 1, x: 0, display: 'block' },
    hidden: { opacity: 0, x: -10, transitionEnd: { display: 'none' } },
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "flex items-center border-b transition-all duration-300",
        isCollapsed && !isMobile ? "h-16 justify-center px-2" : "h-16 px-4 gap-3"
      )}>
        {header}
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
                    {({ isActive }) => (
                      <>
                        <div className="relative shrink-0">
                          <item.icon className={cn("h-5 w-5", isActive && "text-primary-foreground")} />
                          {item.badge}
                        </div>
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
                      </>
                    )}
                  </NavLink>
                </TooltipTrigger>
                {isCollapsed && !isMobile && (
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>

      {/* Footer */}
      {footer && (
        <div className={cn(
          "border-t transition-all duration-300",
          isCollapsed && !isMobile ? "p-2" : "p-4"
        )}>
          {footer}
        </div>
      )}

      {/* Collapse Toggle Button - Desktop only */}
      {!isMobile && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "w-full h-10 rounded-xl transition-all duration-300",
              isCollapsed ? "justify-center" : "justify-start gap-2"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
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
        className="hidden md:flex flex-col border-r bg-sidebar shrink-0"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SidebarContent isMobile />
        </SheetContent>
      </Sheet>

      {/* Mobile Header Bar - Floats above content */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 border-b bg-background/95 backdrop-blur-md z-50 flex items-center px-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(true)}
          className="rounded-xl"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-semibold">{mobileTitle}</span>
      </div>
    </>
  );
}

// Export a simple trigger button for external use
export function SidebarTrigger({ className }: { className?: string }) {
  const { toggle, toggleMobile } = useSidebarState();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        className={cn("hidden md:flex rounded-xl", className)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMobile}
        className={cn("md:hidden rounded-xl", className)}
      >
        <Menu className="h-5 w-5" />
      </Button>
    </>
  );
}

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  setIsCollapsed: (value: boolean) => void;
  setIsMobileOpen: (value: boolean) => void;
  toggle: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarState | undefined>(undefined);

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return saved === 'true';
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const setIsCollapsed = useCallback((value: boolean) => {
    setIsCollapsedState(value);
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsedState((prev) => !prev);
  }, []);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        setIsCollapsed,
        setIsMobileOpen,
        toggle,
        toggleMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarState must be used within a SidebarProvider');
  }
  return context;
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import logoLight from '@/assets/logo-light.png';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#showcase', label: 'Product' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#testimonials', label: 'Testimonials' },
];

export function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch user's workspace if authenticated
  useEffect(() => {
    const fetchWorkspace = async () => {
      if (!user) {
        setWorkspaceId(null);
        return;
      }
      
      const { data } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      if (data) {
        setWorkspaceId(data.workspace_id);
      }
    };

    fetchWorkspace();
  }, [user]);

  const handleDashboardClick = () => {
    if (workspaceId) {
      navigate(`/workspace/${workspaceId}`);
    } else {
      navigate('/onboarding');
    }
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 pt-safe',
        isScrolled 
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm' 
          : 'bg-transparent'
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logoLight} alt="Hamro Task" className="h-8 md:h-10 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA - Show different buttons based on auth state */}
          <div className="hidden md:flex items-center gap-3">
            {!isLoading && user ? (
              // Authenticated user - show Dashboard button
              <Button 
                onClick={handleDashboardClick}
                className="font-semibold rounded-full px-6 brand-gradient shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            ) : (
              // Not authenticated - show Sign In and Get Started
              <>
                <Link to="/auth">
                  <Button variant="ghost" className="font-medium">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button className="font-semibold rounded-full px-6 brand-gradient shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                    Get Started Free
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-3 text-base font-medium text-foreground hover:bg-muted/50 rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 border-t border-border space-y-2">
                {!isLoading && user ? (
                  // Authenticated user - show Dashboard button
                  <Button 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleDashboardClick();
                    }}
                    className="w-full font-semibold rounded-xl h-12 brand-gradient"
                  >
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Go to Dashboard
                  </Button>
                ) : (
                  // Not authenticated - show Sign In and Get Started
                  <>
                    <Link to="/auth" className="block">
                      <Button variant="outline" className="w-full font-medium rounded-xl h-12">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/auth" className="block">
                      <Button className="w-full font-semibold rounded-xl h-12 brand-gradient">
                        Get Started Free
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

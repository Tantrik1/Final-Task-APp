import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Building2, LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logoLight from '@/assets/logo-light.png';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export function MobileHeader() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, setCurrentWorkspaceId } = useWorkspace();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleWorkspaceSwitch = (id: string) => {
    setCurrentWorkspaceId(id);
    navigate(`/workspace/${id}`);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-lg border-b border-border/50 pt-safe">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo & Workspace Switcher */}
        <div className="flex items-center gap-2">
          <Link to={`/workspace/${workspaceId}`} className="flex items-center">
            <img 
              src={logoLight} 
              alt="Hamro Task" 
              className="h-8 w-auto"
            />
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
                <span className="font-medium truncate max-w-[100px] text-sm">
                  {currentWorkspace?.name || 'Workspace'}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  onClick={() => handleWorkspaceSwitch(ws.id)}
                  className={ws.id === currentWorkspace?.id ? 'bg-primary/10' : ''}
                >
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="truncate flex-1">{ws.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{ws.role}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                  <AvatarImage src={undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium truncate">{user?.email?.split('@')[0]}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigate(`/workspace/${workspaceId}/profile`)}
                className="cursor-pointer rounded-lg"
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate(`/workspace/${workspaceId}/settings`)}
                className="cursor-pointer rounded-lg"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut} 
                className="text-destructive cursor-pointer rounded-lg"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

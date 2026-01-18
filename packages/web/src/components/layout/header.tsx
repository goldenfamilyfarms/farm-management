import { Menu, Bell, LogOut, User, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarCollapsed: boolean;
}

export function Header({ onMenuClick, isSidebarCollapsed }: HeaderProps) {
  const { user, farm } = useAuthStore();
  const logoutMutation = useLogout();

  const getInitials = () => {
    if (!user?.profile) return 'U';
    const first = user.profile.firstName?.[0] || '';
    const last = user.profile.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (!user?.profile) return 'User';
    return `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || 'User';
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-card border-b transition-all duration-300',
        'left-0 lg:left-64',
        isSidebarCollapsed && 'lg:left-16'
      )}
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Left side - Mobile menu & Farm selector */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Farm Selector */}
          <Select value={farm?.id} disabled>
            <SelectTrigger className="w-[140px] sm:w-[200px]">
              <SelectValue placeholder="Select farm">
                {farm?.name || 'Select farm'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {farm && (
                <SelectItem value={farm.id}>{farm.name}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Right side - Notifications & User menu */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={user?.profile?.avatarUrl}
                    alt={getUserDisplayName()}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {getUserDisplayName()}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {user?.role}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>{logoutMutation.isPending ? 'Logging out...' : 'Log out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Tractor,
  DollarSign,
  Users,
  Wrench,
  Cloud,
  Lightbulb,
  Leaf,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Fields & Zones',
    href: '/fields',
    icon: Map,
  },
  {
    title: 'Equipment',
    href: '/equipment',
    icon: Tractor,
  },
  {
    title: 'Resources',
    href: '/resources',
    icon: Leaf,
  },
  {
    title: 'Financial',
    href: '/financial',
    icon: DollarSign,
  },
  {
    title: 'Workforce',
    href: '/workforce',
    icon: Users,
  },
  {
    title: 'Maintenance',
    href: '/maintenance',
    icon: Wrench,
  },
  {
    title: 'Weather',
    href: '/weather',
    icon: Cloud,
  },
  {
    title: 'Recommendations',
    href: '/recommendations',
    icon: Lightbulb,
  },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {!isCollapsed && (
            <div className="flex items-center gap-2 text-primary-700">
              <Leaf className="h-6 w-6 shrink-0" />
              <span className="font-semibold truncate">Golden Family Farms</span>
            </div>
          )}
          {isCollapsed && (
            <Leaf className="h-6 w-6 text-primary-700 mx-auto" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground',
                      isCollapsed && 'justify-center px-2'
                    )
                  }
                  title={isCollapsed ? item.title : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span>{item.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onToggle}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}

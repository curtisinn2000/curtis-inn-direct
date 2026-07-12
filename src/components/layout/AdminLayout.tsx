import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, CalendarDays, BedDouble, DollarSign,
  CreditCard, FileText, BarChart3, Settings, LogOut, Menu
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest, setAdminToken } from '@/services/client';

const adminNav = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Reservations', href: '/admin/reservations', icon: CalendarDays },
  { label: 'Availability Center', href: '/admin/calendar', icon: CalendarDays },
  { label: 'Rooms', href: '/admin/rooms', icon: BedDouble },
  { label: 'Rates', href: '/admin/rates', icon: DollarSign },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Content', href: '/admin/content', icon: FileText },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiRequest('/auth/me')
      .then(() => { if (!cancelled) setCheckingAuth(false); })
      .catch(() => {
        if (!cancelled) {
          setAdminToken(null);
          navigate('/admin/login', { replace: true });
        }
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const isActive = (href: string) =>
    href === '/admin'
      ? location.pathname === '/admin'
      : location.pathname.startsWith(href);

  const signOut = () => {
    setAdminToken(null);
    navigate('/admin/login');
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/admin" className="text-lg font-bold text-sidebar-foreground">
          Curtis Admin
        </Link>
        <p className="text-xs text-sidebar-foreground/50 mt-0.5">Hotel Management</p>
      </div>

      <div className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {adminNav.map(item => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors',
              isActive(item.href)
                ? 'bg-sidebar-accent text-sidebar-primary font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground rounded-md w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </nav>
  );

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        Checking admin session...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar shrink-0 transition-transform lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {sidebar}
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-card border-b flex items-center px-4 gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <span className="text-sm text-muted-foreground">Front Desk</span>
        </header>
        <div className="admin-page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

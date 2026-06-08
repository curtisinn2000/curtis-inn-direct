import { Link, useLocation } from 'react-router-dom';
import { PROPERTY } from '@/config/constants';
import { Button } from '@/components/ui/button';
import { Menu, X, Phone, MapPin } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ReservationLookupModal } from '@/components/ReservationLookupModal';

const navLinks = [
  { label: 'Rooms', href: '/rooms' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Location', href: '/location' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container-wide">
        {/* Top bar */}
        <div className="hidden md:flex items-center justify-between py-2 border-b text-caption text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{PROPERTY.address}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{PROPERTY.phone}</span>
          </div>
          <span>Direct bookings — best rates guaranteed</span>
        </div>

        {/* Main nav */}
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">{PROPERTY.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-muted',
                  location.pathname === link.href ? 'text-foreground bg-muted' : 'text-muted-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <ReservationLookupModal />
            <Button asChild>
              <Link to="/booking">Book Now</Link>
            </Button>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 animate-slide-down">
            <nav className="flex flex-col gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    location.pathname === link.href ? 'bg-muted text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 space-y-2">
                <ReservationLookupModal
                  trigger={
                    <Button variant="outline" className="w-full gap-1.5" onClick={() => setMobileOpen(false)}>
                      Check Reservation
                    </Button>
                  }
                />
                <Button asChild className="w-full">
                  <Link to="/booking" onClick={() => setMobileOpen(false)}>Book Now</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

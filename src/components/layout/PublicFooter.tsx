import { Link } from 'react-router-dom';
import { PROPERTY } from '@/config/constants';
import { MapPin, Phone, Mail } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-wide py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold leading-snug">{PROPERTY.name}</h3>
            <p className="mb-3 mt-1 whitespace-nowrap text-xs font-medium opacity-80">{PROPERTY.tagline}</p>
            <p className="text-sm opacity-80 leading-relaxed">
              Affordable comfort in Hollywood, Florida. Steps from the beach, close to everything.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 opacity-60">Explore</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link to="/rooms" className="hover:opacity-100 transition-opacity">Rooms</Link></li>
              <li><Link to="/gallery" className="hover:opacity-100 transition-opacity">Gallery</Link></li>
              <li><Link to="/location" className="hover:opacity-100 transition-opacity">Location</Link></li>
              <li><Link to="/booking" className="hover:opacity-100 transition-opacity">Book Now</Link></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 opacity-60">Information</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link to="/faq" className="hover:opacity-100 transition-opacity">FAQ</Link></li>
              <li><Link to="/policies" className="hover:opacity-100 transition-opacity">Policies</Link></li>
              <li><Link to="/contact" className="hover:opacity-100 transition-opacity">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 opacity-60">Contact</h4>
            <ul className="space-y-3 text-sm opacity-80">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{PROPERTY.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{PROPERTY.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <span>{PROPERTY.email}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center border-t border-primary-foreground/10 pt-8 text-xs opacity-50">
          <p>© {new Date().getFullYear()} {PROPERTY.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PROPERTY } from '@/config/constants';
import { CheckCircle, Phone, Mail, MapPin, Printer } from 'lucide-react';

export default function ConfirmationPage() {
  const [params] = useSearchParams();
  const conf = params.get('conf') || 'CIS-000000';
  const roomName = params.get('room') || '';
  const checkIn = params.get('checkIn') || '';
  const checkOut = params.get('checkOut') || '';
  const method = params.get('method') || '';
  const total = params.get('total') || '0';
  const guestName = params.get('guest')?.replace('+', ' ') || '';

  const statusLabel = method === 'pay_at_property'
    ? { title: 'Reservation Request Received', color: 'text-warning', desc: 'Your reservation request has been received. The property will confirm your booking shortly.' }
    : { title: 'Booking Confirmed', color: 'text-success', desc: 'Your booking is confirmed and payment has been processed securely.' };

  return (
    <div className="section-padding">
      <div className="container-narrow">
        <div className="text-center mb-10 animate-fade-in">
          <CheckCircle className={`h-16 w-16 mx-auto mb-4 ${statusLabel.color}`} />
          <h1 className="text-headline mb-2">{statusLabel.title}</h1>
          <p className="text-body text-muted-foreground">{statusLabel.desc}</p>
        </div>

        <Card className="p-6 md:p-8 mb-8 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Confirmation Number</p>
                <p className="text-xl font-bold font-mono">{conf}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Guest</p>
                <p className="font-medium">{guestName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Room</p>
                <p className="font-medium">{roomName}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Check-in</p>
                <p className="font-medium">{checkIn} at {PROPERTY.checkIn}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Check-out</p>
                <p className="font-medium">{checkOut} at {PROPERTY.checkOut}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-xl font-bold">${Number(total).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <hr className="my-6" />

          <div>
            <p className="text-sm text-muted-foreground mb-4">
              A confirmation email has been sent to your email address. Please keep your confirmation number for your records.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
              <Button asChild size="sm">
                <Link to="/">Return to Homepage</Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* Contact info */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Need help?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" /> {PROPERTY.phone}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" /> {PROPERTY.email}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" /> {PROPERTY.address}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

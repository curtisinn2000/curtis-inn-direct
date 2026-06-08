import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, AlertCircle, Phone, Mail, CalendarDays, Users, CreditCard } from 'lucide-react';
import { getReservationByConfirmation, type ReservationLookupResult } from '@/services/reservationLookup';
import { cn } from '@/lib/utils';

const statusLabel: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  confirmed: 'default',
  checked_in: 'default',
  pending: 'secondary',
  checked_out: 'outline',
  cancelled: 'destructive',
  no_show: 'destructive',
};

const paymentLabel: Record<string, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  deposit_paid: 'Deposit Paid',
  refunded: 'Refunded',
  partial_refund: 'Partial Refund',
};

interface ReservationLookupModalProps {
  trigger?: React.ReactNode;
}

export function ReservationLookupModal({ trigger }: ReservationLookupModalProps) {
  const [open, setOpen] = useState(false);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReservationLookupResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setConfirmationNumber('');
    setLastName('');
    setResult(null);
    setSearched(false);
    setError('');
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!confirmationNumber.trim() || !lastName.trim()) {
      setError('Please fill in both fields.');
      return;
    }

    setLoading(true);
    setResult(null);
    setSearched(false);

    try {
      const data = await getReservationByConfirmation(confirmationNumber, lastName);
      setResult(data);
      setSearched(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <Search className="h-3.5 w-3.5" />
            Check Reservation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Check Your Reservation</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enter your confirmation number and last name to look up your booking.
          </DialogDescription>
        </DialogHeader>

        {!searched || !result ? (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="conf-num" className="text-xs font-medium">Confirmation Number</Label>
              <Input
                id="conf-num"
                placeholder="e.g. CIS-2024-001"
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                disabled={loading}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last-name" className="text-xs font-medium">Last Name</Label>
              <Input
                id="last-name"
                placeholder="Last name on reservation"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
                className="h-10"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {searched && !result && (
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-5 text-center space-y-2">
                <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No reservation found</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
                  Double-check your confirmation number and last name, or contact us directly.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Find Reservation
            </Button>
          </form>
        ) : (
          <div className="space-y-4 pt-2 animate-fade-in">
            <div className="rounded-lg border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-muted-foreground">{result.confirmationNumber}</span>
                <Badge variant={statusVariant[result.status] ?? 'secondary'}>
                  {statusLabel[result.status] ?? result.status}
                </Badge>
              </div>

              <div>
                <p className="text-base font-semibold">{result.guestName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{result.roomType}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{result.checkIn} → {result.checkOut}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>{result.guests} guest{result.guests !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <div className="flex items-center gap-1.5 text-sm">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs font-normal">
                    {paymentLabel[result.paymentStatus] ?? result.paymentStatus}
                  </Badge>
                </div>
                <span className="text-base font-semibold">${result.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-4 space-y-2">
              <p className="text-sm font-medium">Need to make changes?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contact us directly to modify or cancel your reservation.
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {result.propertyPhone}</span>
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {result.propertyEmail}</span>
              </div>
            </div>

            <Button variant="outline" className="w-full h-10" onClick={reset}>
              Look Up Another Reservation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

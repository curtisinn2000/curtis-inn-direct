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
import { Search, Loader2, AlertCircle, Phone, Mail, CalendarDays, Users, CreditCard, CheckCircle2, Download, Send } from 'lucide-react';
import {
  downloadReservationConfirmationPdf,
  getReservationByConfirmation,
  sendReservationConfirmationEmail,
  type ReservationLookupResult,
} from '@/services/reservationLookup';
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
  failed: 'Failed',
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
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const reset = () => {
    setConfirmationNumber('');
    setLastName('');
    setResult(null);
    setSearched(false);
    setError('');
    setLoading(false);
    setEmail('');
    setEmailSending(false);
    setEmailError('');
    setEmailSent(false);
    setPdfDownloading(false);
    setPdfDownloaded(false);
    setPdfError('');
  };

  const handlePdfDownload = async () => {
    if (!result) return;
    setPdfDownloading(true);
    setPdfDownloaded(false);
    setPdfError('');
    try {
      const pdf = await downloadReservationConfirmationPdf({
        confirmationNumber: result.confirmationNumber,
        lastName,
      });
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      const safeConfirmationNumber = result.confirmationNumber.replace(/[^A-Za-z0-9-]/g, '');
      link.href = url;
      link.download = `Curtis-Inn-Reservation-${safeConfirmationNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setPdfDownloaded(true);
    } catch (requestError) {
      setPdfError(requestError instanceof Error ? requestError.message : 'The confirmation PDF could not be downloaded.');
    } finally {
      setPdfDownloading(false);
    }
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || !email.trim()) return;

    setEmailSending(true);
    setEmailError('');
    setEmailSent(false);
    try {
      await sendReservationConfirmationEmail({
        confirmationNumber: result.confirmationNumber,
        lastName,
        email: email.trim(),
      });
      setEmailSent(true);
    } catch (requestError) {
      setEmailError(requestError instanceof Error ? requestError.message : 'The confirmation email could not be sent.');
    } finally {
      setEmailSending(false);
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
                placeholder="e.g. CIS-20260712-0000001"
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

              {result.roomLines?.length > 1 && (
                <div className="rounded-md bg-muted/50 p-3 space-y-1">
                  {result.roomLines.map(line => (
                    <div key={line.roomTypeId} className="flex justify-between text-xs text-muted-foreground">
                      <span>{line.rooms} x {line.roomTypeName}</span>
                      <span>${line.subtotalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

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

            {result.status === 'confirmed' && result.paymentStatus === 'paid' && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Get your confirmation</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Download a PDF or send a copy to the email used for this reservation.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button type="button" variant="outline" className="h-10 w-full" onClick={handlePdfDownload} disabled={pdfDownloading}>
                    {pdfDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {pdfDownloading ? 'Preparing PDF' : 'Download PDF'}
                  </Button>
                  {pdfDownloaded && (
                    <div className="flex items-center gap-2 text-xs font-medium text-green-700" role="status">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      PDF downloaded.
                    </div>
                  )}
                  {pdfError && (
                    <div className="flex items-start gap-2 text-xs text-destructive" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{pdfError}</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-2 border-t border-border/70 pt-4">
                  <Label htmlFor="confirmation-email" className="text-xs font-medium">Email confirmation</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="confirmation-email"
                      type="email"
                      autoComplete="email"
                      placeholder="Email on reservation"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError('');
                        setEmailSent(false);
                      }}
                      disabled={emailSending}
                      required
                      className="h-10 min-w-0 flex-1"
                    />
                    <Button type="submit" className="h-10 shrink-0" disabled={emailSending || !email.trim()}>
                      {emailSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send
                    </Button>
                  </div>
                  {emailSent && (
                    <div className="flex items-center gap-2 text-xs font-medium text-green-700" role="status">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Confirmation sent. Please check your inbox and spam folder.
                    </div>
                  )}
                  {emailError && (
                    <div className="flex items-start gap-2 text-xs text-destructive" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{emailError}</span>
                    </div>
                  )}
                </form>
              </div>
            )}

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

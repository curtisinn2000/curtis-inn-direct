import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PROPERTY } from '@/config/constants';
import type { PaymentMethod, GuestInfo, BookingFormData, BookingCartItem, BookingQuote } from '@/types';
import { createReservation, createStripeCheckoutSession, quoteAvailability } from '@/services/api';
import { CreditCard, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

function parseItems(raw: string | null, roomSlug: string, rooms: number): BookingCartItem[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as BookingCartItem[];
      const valid = parsed
        .filter(item => item?.roomSlug && Number(item.rooms) > 0)
        .map(item => ({ roomSlug: item.roomSlug, rooms: Math.round(Number(item.rooms)) }));
      if (valid.length) return valid;
    } catch {
      return [];
    }
  }
  return roomSlug ? [{ roomSlug, rooms }] : [];
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guests = Number(searchParams.get('guests')) || 1;
  const rooms = Number(searchParams.get('rooms')) || 1;
  const legacyRoomSlug = searchParams.get('roomSlug') || searchParams.get('room') || '';
  const items = useMemo(
    () => parseItems(searchParams.get('items'), legacyRoomSlug, rooms),
    [searchParams, legacyRoomSlug, rooms],
  );

  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState('');
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [guest, setGuest] = useState<GuestInfo>({ firstName: '', lastName: '', email: '', phone: '' });
  const [specialRequests, setSpecialRequests] = useState('');
  const [arrivalTime, setArrivalTime] = useState('3:00 PM');
  const [agreed, setAgreed] = useState(false);
  const paymentMethod: PaymentMethod = 'stripe_pay_now';
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadQuote() {
      if (!checkIn || !checkOut || items.length === 0) {
        setQuote(null);
        setQuoteError('');
        setQuoteLoading(false);
        return;
      }
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const result = await quoteAvailability({ checkIn, checkOut, guests, rooms }, items);
        if (!cancelled) setQuote(result);
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err instanceof Error ? err.message : 'Unable to price selected rooms.');
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    void loadQuote();
    return () => { cancelled = true; };
  }, [checkIn, checkOut, guests, rooms, items]);

  if (quoteLoading) {
    return (
      <div className="section-padding container-narrow text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Pricing selected rooms...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="section-padding container-narrow text-center">
        <h1 className="text-headline mb-4">No rooms selected</h1>
        {quoteError && <p className="text-sm text-muted-foreground mb-6">{quoteError}</p>}
        <Button asChild><a href="/booking">Back to search</a></Button>
      </div>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: BookingFormData = {
        search: { checkIn, checkOut, guests, rooms },
        selectedRoom: null,
        items,
        guestInfo: guest,
        specialRequests,
        arrivalTime,
        paymentMethod,
        agreedToPolicies: agreed,
      };

      const reservation = await createReservation(payload);
      const session = await createStripeCheckoutSession(reservation.id);
      window.location.href = session.sessionUrl;
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Unable to complete reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section-padding">
      <div className="container-wide">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 text-sm">
              <span className={cn('px-3 py-1 rounded-full text-xs font-medium', step === 'details' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>Guest Details</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className={cn('px-3 py-1 rounded-full text-xs font-medium', step === 'payment' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>Payment</span>
            </div>

            {step === 'details' && (
              <Card className="p-6 space-y-5">
                <h2 className="text-title">Guest Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input id="firstName" value={guest.firstName} onChange={e => setGuest(g => ({ ...g, firstName: e.target.value }))} required />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input id="lastName" value={guest.lastName} onChange={e => setGuest(g => ({ ...g, lastName: e.target.value }))} required />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={guest.email} onChange={e => setGuest(g => ({ ...g, email: e.target.value }))} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input id="phone" type="tel" value={guest.phone} onChange={e => setGuest(g => ({ ...g, phone: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="arrival">Estimated Arrival Time</Label>
                  <Input id="arrival" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} placeholder="e.g. 3:00 PM" />
                </div>
                <div>
                  <Label htmlFor="requests">Special Requests</Label>
                  <Textarea id="requests" value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Any special requests for your stay..." rows={3} />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="agree" checked={agreed} onCheckedChange={c => setAgreed(c as boolean)} />
                  <Label htmlFor="agree" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    I agree to the hotel policies, including check-in at {PROPERTY.checkIn} and check-out at {PROPERTY.checkOut}. I understand the cancellation policy.
                  </Label>
                </div>
                <Button
                  onClick={() => setStep('payment')}
                  disabled={!guest.firstName || !guest.lastName || !guest.email || !guest.phone || !agreed}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  size="lg"
                >
                  Continue to Payment
                </Button>
              </Card>
            )}

            {step === 'payment' && (
              <Card className="p-6 space-y-5">
                <h2 className="text-title">Payment Method</h2>
                <div className="w-full text-left p-4 rounded-lg border-2 border-accent bg-accent/5">
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 mt-0.5 shrink-0 text-accent" />
                    <div>
                      <p className="font-medium text-sm">Pay Now</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Secure payment via Stripe. Your card is never stored by us.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 shrink-0" />
                  You will be redirected to Stripe's secure payment page. Your card details are never stored by {PROPERTY.name}.
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('details')} disabled={submitting} className="flex-1">Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Proceed to Payment
                  </Button>
                </div>
              </Card>
            )}
          </div>

          <div>
            <Card className="p-6 sticky top-24">
              <h3 className="font-semibold mb-4">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                {quote.lines.map(line => (
                  <div key={line.roomType.slug} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{line.rooms} x {line.roomType.name}</span>
                    <span className="font-medium">${line.subtotalAmount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span>{checkIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span>{checkOut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{quote.nights} night{quote.nights > 1 ? 's' : ''}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${quote.totalRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes & fees</span>
                  <span>${quote.taxes.toFixed(2)}</span>
                </div>
                <hr />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>${quote.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

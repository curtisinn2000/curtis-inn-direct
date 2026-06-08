import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MOCK_ROOMS } from '@/data/mock-rooms';
import { useInventoryStore, getRoomBySlug } from '@/store/inventoryStore';
import { PROPERTY } from '@/config/constants';
import type { PaymentMethod, GuestInfo } from '@/types';
import { Shield, CreditCard, Clock, Loader2, ArrowLeft, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const roomSlug = searchParams.get('roomSlug') || '';
  const storeRoom = useInventoryStore(s => getRoomBySlug(s, roomSlug));
  const fallback = MOCK_ROOMS.find(r => r.slug === roomSlug);
  const room = storeRoom
    ? { id: storeRoom.id, slug: storeRoom.slug, name: storeRoom.name, basePrice: storeRoom.basePrice }
    : fallback;
  const nights = Number(searchParams.get('nights')) || 1;
  const total = Number(searchParams.get('total')) || 0;
  const taxes = Number(searchParams.get('taxes')) || 0;
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';

  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [guest, setGuest] = useState<GuestInfo>({ firstName: '', lastName: '', email: '', phone: '' });
  const [specialRequests, setSpecialRequests] = useState('');
  const [arrivalTime, setArrivalTime] = useState('3:00 PM');
  const [agreed, setAgreed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('clover_pay_now');
  const [submitting, setSubmitting] = useState(false);

  if (!room) {
    return (
      <div className="section-padding container-narrow text-center">
        <h1 className="text-headline mb-4">No room selected</h1>
        <Button asChild><a href="/booking">Back to search</a></Button>
      </div>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    const confNum = `CIS-${Date.now().toString().slice(-6)}`;
    navigate(`/booking/confirmation?conf=${confNum}&room=${room.name}&checkIn=${checkIn}&checkOut=${checkOut}&method=${paymentMethod}&total=${total}&guest=${guest.firstName}+${guest.lastName}`);
  };

  const paymentOptions: { method: PaymentMethod; title: string; desc: string; icon: React.ElementType }[] = [
    { method: 'clover_pay_now', title: 'Pay Now', desc: 'Secure payment via Clover. Your card is never stored by us.', icon: CreditCard },
    { method: 'pay_at_property', title: 'Reserve Now, Pay at Property', desc: 'No payment required now. Pay upon arrival at the front desk.', icon: Clock },
    { method: 'clover_deposit', title: 'Deposit & Guarantee', desc: 'Secure your reservation with a one-night deposit via Clover.', icon: Shield },
  ];

  return (
    <div className="section-padding">
      <div className="container-wide">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Steps indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className={cn('px-3 py-1 rounded-full text-xs font-medium', step === 'details' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>Guest Details</span>
              <span className="text-muted-foreground">→</span>
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
                <div className="space-y-3">
                  {paymentOptions.map(opt => (
                    <button
                      key={opt.method}
                      onClick={() => setPaymentMethod(opt.method)}
                      className={cn(
                        'w-full text-left p-4 rounded-lg border-2 transition-all',
                        paymentMethod === opt.method ? 'border-accent bg-accent/5' : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <opt.icon className={cn('h-5 w-5 mt-0.5 shrink-0', paymentMethod === opt.method ? 'text-accent' : 'text-muted-foreground')} />
                        <div>
                          <p className="font-medium text-sm">{opt.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'clover_pay_now' && (
                  <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0" />
                    You will be redirected to Clover's secure payment page. Your card details are never stored by {PROPERTY.name}.
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('details')} disabled={submitting} className="flex-1">Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {paymentMethod === 'pay_at_property' ? 'Complete Reservation' : 'Proceed to Payment'}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Order summary */}
          <div>
            <Card className="p-6 sticky top-24">
              <h3 className="font-semibold mb-4">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{room.name}</span>
                </div>
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
                  <span>{nights} night{nights > 1 ? 's' : ''}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${(total - taxes).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes & fees</span>
                  <span>${taxes.toFixed(2)}</span>
                </div>
                <hr />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

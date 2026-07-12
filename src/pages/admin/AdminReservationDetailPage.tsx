import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getReservationById } from '@/services/api';
import { updateReservationStatus } from '@/services/api';
import type { Reservation } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Mail, Phone, CheckCircle, XCircle, Clock, UserCheck, LogOut } from 'lucide-react';

export default function AdminReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [res, setRes] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) getReservationById(id).then(r => { setRes(r); setLoading(false); });
  }, [id]);

  if (loading) return <div className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
  if (!res) return <div className="text-center py-20"><h2 className="text-title">Reservation not found</h2></div>;

  const actions = [
    { label: 'Check In', icon: UserCheck, status: 'checked_in' as const },
    { label: 'Check Out', icon: LogOut, status: 'checked_out' as const },
    { label: 'Cancel', icon: XCircle, status: 'cancelled' as const, variant: 'destructive' as const },
    { label: 'No-Show', icon: Clock, status: 'no_show' as const, variant: 'destructive' as const },
  ];

  const runStatusAction = async (status: Reservation['status']) => {
    if (!res) return;
    const updated = await updateReservationStatus(res.id, status);
    setRes(updated);
  };

  return (
    <div>
      <Link to="/admin/reservations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> All reservations
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">{res.confirmationNumber}</h1>
          <p className="text-sm text-muted-foreground">{res.guest.firstName} {res.guest.lastName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Mail className="mr-1 h-4 w-4" /> Resend Confirmation</Button>
          <Button variant="outline" size="sm">Edit</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Reservation Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Status</p><Badge className="mt-1">{res.status}</Badge></div>
              <div><p className="text-muted-foreground text-xs">Payment</p><Badge variant="secondary" className="mt-1">{res.paymentStatus}</Badge></div>
              <div><p className="text-muted-foreground text-xs">Method</p><p className="mt-1 capitalize">{res.paymentMethod.replace(/_/g, ' ')}</p></div>
              <div><p className="text-muted-foreground text-xs">Source</p><p className="mt-1 capitalize">{res.source.replace(/_/g, ' ')}</p></div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4">Stay Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Room</p><p className="font-medium">{res.roomTypeName}</p></div>
              <div><p className="text-muted-foreground text-xs">Check-in</p><p>{res.checkIn}</p></div>
              <div><p className="text-muted-foreground text-xs">Check-out</p><p>{res.checkOut}</p></div>
              <div><p className="text-muted-foreground text-xs">Nights</p><p>{res.nights}</p></div>
              <div><p className="text-muted-foreground text-xs">Guests</p><p>{res.guests}</p></div>
              <div><p className="text-muted-foreground text-xs">Rooms</p><p>{res.rooms}</p></div>
              <div><p className="text-muted-foreground text-xs">Arrival</p><p>{res.arrivalTime}</p></div>
              <div><p className="text-muted-foreground text-xs">Motel Pro</p><p>{res.addedToMotelPro ? '✓ Added' : 'Not added'}</p></div>
            </div>
            {res.specialRequests && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Special Requests</p>
                <p className="text-sm">{res.specialRequests}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4">Guest Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Name</p><p>{res.guest.firstName} {res.guest.lastName}</p></div>
              <div><p className="text-muted-foreground text-xs">Email</p><p className="flex items-center gap-1"><Mail className="h-3 w-3" />{res.guest.email}</p></div>
              <div><p className="text-muted-foreground text-xs">Phone</p><p className="flex items-center gap-1"><Phone className="h-3 w-3" />{res.guest.phone}</p></div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Internal Notes</h3>
            {res.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet</p>
            ) : (
              <ul className="space-y-2">
                {res.notes.map((n, i) => (
                  <li key={i} className="text-sm p-3 bg-muted rounded-lg">{n}</li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" className="mt-3">Add Note</Button>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Payment Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${(res.totalAmount - res.taxAmount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span>${res.taxAmount.toFixed(2)}</span></div>
              {res.depositAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Deposit paid</span><span>-${res.depositAmount.toFixed(2)}</span></div>}
              <hr />
              <div className="flex justify-between font-bold"><span>Total</span><span>${res.totalAmount.toFixed(2)}</span></div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4">Actions</h3>
            <div className="space-y-2">
              {actions.map(a => (
                <Button key={a.label} variant={a.variant || 'outline'} size="sm" className="w-full justify-start" onClick={() => runStatusAction(a.status)}>
                  <a.icon className="mr-2 h-4 w-4" /> {a.label}
                </Button>
              ))}
              <hr />
              <Button variant="outline" size="sm" className="w-full justify-start">
                <CheckCircle className="mr-2 h-4 w-4" /> Mark Added to Motel Pro
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

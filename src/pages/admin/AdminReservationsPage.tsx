import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getReservations } from '@/services/api';
import type { Reservation, ReservationStatus } from '@/types';
import { Search, Filter, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusColors: Record<ReservationStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  confirmed: 'bg-success/10 text-success',
  checked_in: 'bg-info/10 text-info',
  checked_out: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  no_show: 'bg-destructive/10 text-destructive',
};

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    getReservations().then(r => { setReservations(r); setLoading(false); });
  }, []);

  const filtered = reservations.filter(r => {
    const matchesSearch = search === '' ||
      r.guest.firstName.toLowerCase().includes(search.toLowerCase()) ||
      r.guest.lastName.toLowerCase().includes(search.toLowerCase()) ||
      r.confirmationNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['all', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Reservations</h1>
          <p className="text-sm text-muted-foreground">{reservations.length} total</p>
        </div>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Reservation</Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by guest or confirmation #" className="pl-9" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-xs rounded-full transition-colors capitalize', statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-muted/50 rounded-xl">
          <p className="text-muted-foreground">No reservations found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(res => (
            <Link key={res.id} to={`/admin/reservations/${res.id}`}>
              <Card className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium text-sm">{res.guest.firstName} {res.guest.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{res.confirmationNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span>{res.roomTypeSummary || res.roomTypeName}</span>
                    <span>{res.checkIn} → {res.checkOut}</span>
                    <span className="font-semibold text-foreground">${res.totalAmount.toFixed(2)}</span>
                    <Badge className={cn('text-xs', statusColors[res.status])}>{res.status.replace('_', ' ')}</Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

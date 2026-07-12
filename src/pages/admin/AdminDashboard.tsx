import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { getDashboardStats, getPayments, getReservations } from '@/services/api';
import type { DashboardStats, Payment, Reservation } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, Users, BedDouble, DollarSign, CalendarDays, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getReservations(), getPayments()])
      .then(([s, r, p]) => { setStats(s); setReservations(r); setPayments(p); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const statCards = [
    { label: 'Arrivals Today', value: stats.arrivalsToday, icon: CalendarDays, color: 'text-info' },
    { label: 'Departures Today', value: stats.departuresToday, icon: Clock, color: 'text-warning' },
    { label: 'Active Stays', value: stats.activeStays, icon: BedDouble, color: 'text-success' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: Users, color: 'text-destructive' },
    { label: 'Confirmed Bookings', value: stats.confirmedBookings, icon: CalendarDays, color: 'text-foreground' },
    { label: 'Occupancy', value: `${stats.occupancyPercent}%`, icon: TrendingUp, color: 'text-accent' },
    { label: 'Available Rooms', value: `${stats.availableRooms}/${stats.totalRooms}`, icon: BedDouble, color: 'text-muted-foreground' },
    { label: 'Revenue Today', value: `$${stats.revenueToday.toLocaleString()}`, icon: DollarSign, color: 'text-success' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview for today</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent reservations */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Reservations</h3>
            <Link to="/admin/reservations" className="text-xs text-accent hover:underline flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          <div className="space-y-3">
            {reservations.slice(0, 5).map(res => (
              <Link key={res.id} to={`/admin/reservations/${res.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                <div>
                  <p className="text-sm font-medium">{res.guest.firstName} {res.guest.lastName}</p>
                  <p className="text-xs text-muted-foreground">{res.roomTypeSummary || res.roomTypeName} · {res.checkIn}</p>
                </div>
                <Badge variant={res.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                  {res.status}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent payments */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Payments</h3>
            <Link to="/admin/payments" className="text-xs text-accent hover:underline flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          <div className="space-y-3">
            {payments.slice(0, 5).map(pay => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                <div>
                  <p className="text-sm font-medium">{pay.guestName}</p>
                  <p className="text-xs text-muted-foreground">{pay.confirmationNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${pay.amount.toFixed(2)}</p>
                  <Badge variant="secondary" className="text-xs">{pay.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

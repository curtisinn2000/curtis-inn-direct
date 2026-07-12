import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BedDouble, ArrowRight, Loader2 } from 'lucide-react';
import roomImg from '@/assets/room-king.jpg';
import type { RoomType } from '@/types';
import { getRoomTypes } from '@/services/api';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      setLoading(true);
      setError(null);
      try {
        const result = await getRoomTypes();
        if (!cancelled) setRooms(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load rooms.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRooms();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-12">
          <p className="text-overline mb-2">Accommodations</p>
          <h1 className="text-headline mb-4">Our Rooms & Suites</h1>
          <p className="text-body text-muted-foreground max-w-2xl">
            From cozy singles to spacious two-bedroom suites, find the perfect room for your Hollywood, Florida stay.
          </p>
        </div>

        {loading && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
            Loading rooms...
          </Card>
        )}

        {!loading && error && (
          <Card className="p-10 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {!loading && !error && rooms.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No rooms are currently available online.
          </Card>
        )}

        {!loading && !error && rooms.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <Link key={room.slug} to={`/room/${room.slug}`} className="block h-full">
              <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                  <img src={room.images[0] ?? roomImg} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  {room.inventoryCount === 0 && (
                    <div className="absolute top-3 left-3">
                      <Badge variant="secondary" className="bg-foreground text-background">Sold out</Badge>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h2 className="text-lg font-semibold mb-2 min-h-[3.5rem] line-clamp-2">{room.name}</h2>
                  <p className="text-sm text-muted-foreground mb-4 min-h-[4.5rem] line-clamp-3">{room.shortDescription}</p>
                  <div className="flex min-h-[2.25rem] flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Up to {room.occupancy}</span>
                    <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {room.bedType}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t">
                    <div>
                      <span className="text-xl font-bold">${room.basePrice}</span>
                      <span className="text-sm text-muted-foreground"> / night</span>
                    </div>
                    <Button variant="ghost" size="sm">
                      Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>}
      </div>
    </div>
  );
}

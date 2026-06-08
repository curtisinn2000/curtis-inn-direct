import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { searchAvailability } from '@/services/api';
import type { AvailabilityResult, AvailabilitySearch } from '@/types';
import { Users, BedDouble, Calendar, Loader2 } from 'lucide-react';
import roomImg from '@/assets/room-king.jpg';

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState<AvailabilitySearch>({
    checkIn: searchParams.get('checkIn') || '',
    checkOut: searchParams.get('checkOut') || '',
    guests: Number(searchParams.get('guests')) || 2,
    rooms: Number(searchParams.get('rooms')) || 1,
  });
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (search.checkIn && search.checkOut) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!search.checkIn || !search.checkOut) return;
    setLoading(true);
    try {
      const data = await searchAvailability(search);
      setResults(data);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: AvailabilityResult) => {
    const params = new URLSearchParams({
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      guests: String(search.guests),
      rooms: String(search.rooms),
      roomSlug: result.roomType.slug,
      nights: String(result.nights),
      rate: String(result.nightlyRate),
      total: String(result.grandTotal),
      taxes: String(result.taxes),
    });
    navigate(`/booking/checkout?${params.toString()}`);
  };

  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <p className="text-overline mb-2">Booking</p>
          <h1 className="text-headline">Find your perfect room</h1>
        </div>

        {/* Search */}
        <Card className="p-6 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Check-in
              </Label>
              <Input type="date" value={search.checkIn} onChange={e => setSearch(s => ({ ...s, checkIn: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Check-out
              </Label>
              <Input type="date" value={search.checkOut} onChange={e => setSearch(s => ({ ...s, checkOut: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Guests</Label>
              <Input type="number" min={1} max={10} value={search.guests} onChange={e => setSearch(s => ({ ...s, guests: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Rooms</Label>
              <Input type="number" min={1} max={5} value={search.rooms} onChange={e => setSearch(s => ({ ...s, rooms: Number(e.target.value) }))} />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search Availability'}
            </Button>
          </div>
        </Card>

        {/* Results */}
        {loading && (
          <div className="text-center py-20">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-3">Searching availability...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-20 bg-muted/50 rounded-xl">
            <h3 className="text-title mb-2">No rooms available</h3>
            <p className="text-muted-foreground">Try adjusting your dates or guest count.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{results.length} rooms available for {results[0].nights} night{results[0].nights > 1 ? 's' : ''}</p>
            {results.map(result => (
              <Card key={result.roomType.slug} className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_220px] gap-0">
                  <div className="aspect-[4/3] md:aspect-auto bg-muted">
                    <img src={result.roomType.images?.[0] || roomImg} alt={result.roomType.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold mb-1">{result.roomType.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{result.roomType.shortDescription}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {result.roomType.occupancy} guests</span>
                      <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {result.roomType.bedType}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-xs">Free cancellation</Badge>
                      {result.available > 0
                        ? <Badge variant="secondary" className="text-xs">{result.available} left</Badge>
                        : <Badge className="text-xs bg-foreground text-background">Sold out</Badge>}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col justify-center border-t md:border-t-0 md:border-l bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">{result.nights} night{result.nights > 1 ? 's' : ''}</p>
                    <p className="text-sm text-muted-foreground">${result.nightlyRate}/night</p>
                    <p className="text-xs text-muted-foreground mb-1">Taxes: ${result.taxes.toFixed(2)}</p>
                    <p className="text-2xl font-bold mb-3">${result.grandTotal.toFixed(2)}</p>
                    <Button
                      onClick={() => handleSelect(result)}
                      disabled={result.available === 0}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {result.available === 0 ? 'Sold out' : 'Select Room'}
                    </Button>
                    {result.available > 0 && (
                      <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => handleSelect(result)}>
                        Reserve & Pay Later
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

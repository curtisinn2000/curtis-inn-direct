import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as DateRangeCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { searchAvailability } from '@/services/api';
import type { AvailabilityResult, AvailabilitySearch, BookingCartItem } from '@/types';
import { Users, BedDouble, Calendar, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import roomImg from '@/assets/room-king.jpg';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { dateFromKey, earliestPublicCheckInDate, earliestPublicCheckInKey } from '@/lib/bookingDates';

type CartLine = {
  result: AvailabilityResult;
  rooms: number;
};

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const initialCheckIn = searchParams.get('checkIn') || '';
  const initialCheckOut = searchParams.get('checkOut') || '';

  const [search, setSearch] = useState<AvailabilitySearch>({
    checkIn: initialCheckIn,
    checkOut: initialCheckOut,
    guests: Number(searchParams.get('guests')) || 2,
    rooms: Number(searchParams.get('rooms')) || 1,
  });
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: initialCheckIn ? dateFromKey(initialCheckIn) : undefined,
    to: initialCheckOut ? dateFromKey(initialCheckOut) : undefined,
  }));
  const [dateOpen, setDateOpen] = useState(false);
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const minCheckIn = earliestPublicCheckInKey();
  const earliestCheckIn = earliestPublicCheckInDate();
  const requestedRooms = Math.max(1, Number(search.rooms) || 1);
  const dateLabel = range?.from
    ? range.to
      ? `${format(range.from, 'MMM d')} to ${format(range.to, 'MMM d, yyyy')}`
      : `${format(range.from, 'MMM d, yyyy')} to select check-out`
    : 'Select your dates';

  const selectedRooms = cart.reduce((sum, line) => sum + line.rooms, 0);
  const remainingToSelect = Math.max(0, requestedRooms - selectedRooms);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.result.totalRate * line.rooms, 0);
  const cartTaxes = cart.reduce((sum, line) => sum + line.result.taxes * line.rooms, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.result.grandTotal * line.rooms, 0);
  const cartItems: BookingCartItem[] = useMemo(
    () => cart.map(line => ({ roomSlug: line.result.roomType.slug, rooms: line.rooms })),
    [cart],
  );

  useEffect(() => {
    if (search.checkIn && search.checkOut) {
      void handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!search.checkIn || !search.checkOut) return;
    if (search.checkIn < minCheckIn) {
      setError(`Online bookings cannot start before ${minCheckIn}. Same-day bookings still check in at 3:00 PM.`);
      setResults([]);
      setSearched(true);
      return;
    }
    if (search.checkOut <= search.checkIn) {
      setError('Check-out must be after check-in.');
      setResults([]);
      setSearched(true);
      return;
    }
    setLoading(true);
    setError('');
    setCart([]);
    try {
      const data = await searchAvailability(search);
      setResults(data);
      setSearched(true);
    } catch (err) {
      setResults([]);
      setSearched(true);
      setError(err instanceof Error ? err.message : 'Unable to search availability.');
    } finally {
      setLoading(false);
    }
  };

  const handleRangeSelect = (nextRange: DateRange | undefined) => {
    setRange(nextRange);
    setSearch(current => ({
      ...current,
      checkIn: nextRange?.from ? format(nextRange.from, 'yyyy-MM-dd') : '',
      checkOut: nextRange?.to ? format(nextRange.to, 'yyyy-MM-dd') : '',
    }));
    if (nextRange?.from && nextRange?.to) setDateOpen(false);
  };

  const addRoom = (result: AvailabilityResult) => {
    if (selectedRooms >= requestedRooms) return;
    setCart(current => {
      const existing = current.find(line => line.result.roomType.slug === result.roomType.slug);
      if (existing && existing.rooms >= result.available) return current;
      if (existing) {
        return current.map(line => line.result.roomType.slug === result.roomType.slug ? { ...line, rooms: line.rooms + 1 } : line);
      }
      return [...current, { result, rooms: 1 }];
    });
  };

  const removeOne = (slug: string) => {
    setCart(current => current.flatMap(line => {
      if (line.result.roomType.slug !== slug) return [line];
      if (line.rooms <= 1) return [];
      return [{ ...line, rooms: line.rooms - 1 }];
    }));
  };

  const removeLine = (slug: string) => {
    setCart(current => current.filter(line => line.result.roomType.slug !== slug));
  };

  const handleCheckout = () => {
    if (selectedRooms !== requestedRooms) return;
    const params = new URLSearchParams({
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      guests: String(search.guests),
      rooms: String(search.rooms),
      items: JSON.stringify(cartItems),
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

        <Card className="p-6 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_220px] gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Check-in and check-out
              </Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-10',
                      !range?.from && 'text-muted-foreground',
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start" sideOffset={8}>
                  <DateRangeCalendar
                    mode="range"
                    selected={range}
                    onSelect={handleRangeSelect}
                    numberOfMonths={isMobile ? 1 : 2}
                    defaultMonth={range?.from ?? earliestCheckIn}
                    disabled={(date) => date < earliestCheckIn}
                    initialFocus
                    className="p-4 pointer-events-auto [&_.rdp-day]:h-11 [&_.rdp-day]:w-11 [&_.rdp-day]:text-base [&_.rdp-head_cell]:w-11 [&_.rdp-caption_label]:text-base [&_.rdp-caption_label]:font-semibold"
                  />
                </PopoverContent>
              </Popover>
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

        {!loading && error && (
          <div className="mb-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{results.length} room types available for {results[0].nights} night{results[0].nights > 1 ? 's' : ''}</p>
              {results.map(result => {
                const selectedForType = cart.find(line => line.result.roomType.slug === result.roomType.slug)?.rooms ?? 0;
                const canAdd = result.available > selectedForType && selectedRooms < requestedRooms;
                return (
                  <Card key={result.roomType.slug} className="overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_220px] gap-0">
                      <div className="aspect-[4/3] md:aspect-auto bg-muted">
                        <img src={result.roomType.images?.[0] || roomImg} alt={result.roomType.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-semibold mb-1">{result.roomType.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{result.roomType.shortDescription}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {result.roomType.occupancy} guests each</span>
                          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {result.roomType.bedType}</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">Free cancellation</Badge>
                          {result.available > 0
                            ? <Badge variant="secondary" className="text-xs">{result.available} left</Badge>
                            : <Badge className="text-xs bg-foreground text-background">Sold out</Badge>}
                          {selectedForType > 0 && <Badge className="text-xs">{selectedForType} selected</Badge>}
                        </div>
                      </div>
                      <div className="p-5 flex flex-col justify-center border-t md:border-t-0 md:border-l bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">{result.nights} night{result.nights > 1 ? 's' : ''}, per room</p>
                        <p className="text-sm text-muted-foreground">${result.nightlyRate}/night</p>
                        <p className="text-xs text-muted-foreground mb-1">Taxes: ${result.taxes.toFixed(2)}</p>
                        <p className="text-2xl font-bold mb-3">${result.grandTotal.toFixed(2)}</p>
                        <Button
                          onClick={() => addRoom(result)}
                          disabled={!canAdd}
                          className="bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                          {selectedForType > 0 ? 'Add Another' : 'Add Room'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="p-5 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Selected Rooms</h2>
                <Badge variant={selectedRooms === requestedRooms ? 'default' : 'secondary'}>
                  {selectedRooms} of {requestedRooms}
                </Badge>
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add {requestedRooms} room{requestedRooms > 1 ? 's' : ''} to continue.</p>
              ) : (
                <div className="space-y-3">
                  {cart.map(line => (
                    <div key={line.result.roomType.slug} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{line.result.roomType.name}</p>
                          <p className="text-xs text-muted-foreground">${line.result.grandTotal.toFixed(2)} per room</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(line.result.roomType.slug)} aria-label="Remove room type">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeOne(line.result.roomType.slug)}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">{line.rooms}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={line.rooms >= line.result.available || selectedRooms >= requestedRooms} onClick={() => addRoom(line.result)}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <span className="text-sm font-semibold">${(line.result.grandTotal * line.rooms).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${cartSubtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes & fees</span><span>${cartTaxes.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>${cartTotal.toFixed(2)}</span></div>
              </div>

              {remainingToSelect > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">Select {remainingToSelect} more room{remainingToSelect > 1 ? 's' : ''} to continue.</p>
              )}
              <Button
                onClick={handleCheckout}
                disabled={selectedRooms !== requestedRooms}
                className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                size="lg"
              >
                Continue to Checkout
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertCircle, BedDouble, Calendar as CalendarIcon, Loader2, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { earliestPublicCheckInDate } from '@/lib/bookingDates';

export function BookingWidget() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [range, setRange] = useState<DateRange>();
  const [open, setOpen] = useState(false);
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [rooms, setRooms] = useState('1');
  const [isSearching, setIsSearching] = useState(false);
  const earliestCheckIn = earliestPublicCheckInDate();
  const adultCount = Number(adults);
  const childCount = Number(children);
  const roomCount = Number(rooms);
  const guestCountInvalid = !Number.isInteger(adultCount) || adultCount < 1 || adultCount > 20 || !Number.isInteger(childCount) || childCount < 0 || childCount > 20 || adultCount + childCount > 20;
  const roomCountInvalid = !Number.isInteger(roomCount) || roomCount < 1 || roomCount > 5;
  const countError = guestCountInvalid
    ? 'Enter 1 to 20 adults and no more than 20 total guests.'
    : roomCountInvalid
      ? 'Rooms must be between 1 and 5.'
      : '';

  function handleSearch() {
    if (!range?.from || !range.to || countError) return;
    setIsSearching(true);
    const params = new URLSearchParams({
      checkIn: format(range.from, 'yyyy-MM-dd'),
      checkOut: format(range.to, 'yyyy-MM-dd'),
      adults,
      children,
      guests: String(adultCount + childCount),
      rooms,
    });
    navigate(`/booking?${params.toString()}`);
  }

  const dateLabel = range?.from
    ? range.to
      ? `${format(range.from, 'MMM d')} to ${format(range.to, 'MMM d, yyyy')}`
      : `${format(range.from, 'MMM d, yyyy')} to select check-out`
    : 'Select your dates';

  return (
    <div className="rounded-lg border border-border/80 bg-card p-4 shadow-xl sm:p-5 lg:p-6">
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 lg:grid-cols-[minmax(300px,1fr)_110px_110px_100px_160px] lg:gap-4">
        <div className="md:col-span-2 lg:col-span-1">
          <Label className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <CalendarIcon className="h-4 w-4 text-accent" /> Check-in and check-out
          </Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-14 w-full justify-start rounded-md border-border bg-background px-4 text-left font-normal shadow-none hover:bg-muted/40',
                  !range?.from && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="mr-3 h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="truncate">{dateLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start" sideOffset={8}>
              <Calendar
                mode="range"
                selected={range}
                onSelect={nextRange => {
                  setRange(nextRange);
                  if (nextRange?.from && nextRange.to) setOpen(false);
                }}
                numberOfMonths={isMobile ? 1 : 2}
                defaultMonth={range?.from ?? earliestCheckIn}
                disabled={date => date < earliestCheckIn}
                initialFocus
                className="p-4 pointer-events-auto [&_.rdp-day]:h-11 [&_.rdp-day]:w-11 [&_.rdp-day]:text-base [&_.rdp-head_cell]:w-11 [&_.rdp-caption_label]:text-base [&_.rdp-caption_label]:font-semibold"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="w-full">
          <Label htmlFor="adults" className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <Users className="h-4 w-4 text-accent" /> Adults
          </Label>
          <Input
            id="adults"
            type="number"
            inputMode="numeric"
            min="1"
            max="20"
            value={adults}
            onChange={event => setAdults(event.target.value)}
            className="h-14 bg-background px-4 text-base"
            aria-invalid={guestCountInvalid}
          />
        </div>

        <div className="w-full">
          <Label htmlFor="children" className="mb-2 text-xs font-semibold text-foreground">Children</Label>
          <Input id="children" type="number" inputMode="numeric" min="0" max="20" value={children} onChange={event => setChildren(event.target.value)} className="h-14 bg-background px-4 text-base" aria-invalid={guestCountInvalid} />
        </div>

        <div className="w-full">
          <Label htmlFor="rooms" className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
            <BedDouble className="h-4 w-4 text-accent" /> Rooms
          </Label>
          <Input
            id="rooms"
            type="number"
            inputMode="numeric"
            min="1"
            max="5"
            value={rooms}
            onChange={event => setRooms(event.target.value)}
            className="h-14 bg-background px-4 text-base"
            aria-invalid={roomCountInvalid}
          />
        </div>

        <Button
          onClick={handleSearch}
          size="lg"
          disabled={!range?.from || !range.to || Boolean(countError) || isSearching}
          className="h-14 w-full bg-accent text-base font-semibold text-accent-foreground shadow-sm hover:bg-accent/90"
        >
          {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Search className="mr-2 h-5 w-5" />}
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {countError && (
        <p className="mt-3 flex items-center gap-2 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" /> {countError}
        </p>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Users, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export function BookingWidget() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [range, setRange] = useState<DateRange | undefined>();
  const [open, setOpen] = useState(false);
  const [guests, setGuests] = useState('2');
  const [rooms, setRooms] = useState('1');

  const handleSearch = () => {
    if (!range?.from || !range?.to) return;
    const params = new URLSearchParams({
      checkIn: format(range.from, 'yyyy-MM-dd'),
      checkOut: format(range.to, 'yyyy-MM-dd'),
      guests,
      rooms,
    });
    navigate(`/booking?${params.toString()}`);
  };

  const dateLabel = range?.from
    ? range.to
      ? `${format(range.from, 'MMM d')} — ${format(range.to, 'MMM d, yyyy')}`
      : `${format(range.from, 'MMM d, yyyy')} — Select check-out`
    : 'Select your dates';

  return (
    <div className="bg-card rounded-xl border shadow-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-4 items-end">
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" /> Check-in — Check-out
          </Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal h-10',
                  !range?.from && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 pointer-events-auto"
              align="start"
              sideOffset={8}
            >
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  if (r?.from && r?.to) setOpen(false);
                }}
                numberOfMonths={isMobile ? 1 : 2}
                defaultMonth={range?.from ?? new Date()}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className="p-4 pointer-events-auto [&_.rdp-day]:h-11 [&_.rdp-day]:w-11 [&_.rdp-day]:text-base [&_.rdp-head_cell]:w-11 [&_.rdp-caption_label]:text-base [&_.rdp-caption_label]:font-semibold"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-full md:w-28">
          <Label htmlFor="guests" className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" /> Guests
          </Label>
          <Input id="guests" type="number" min="1" max="10" value={guests} onChange={e => setGuests(e.target.value)} />
        </div>
        <div className="w-full md:w-24">
          <Label htmlFor="rooms" className="text-xs font-medium text-muted-foreground mb-1.5">Rooms</Label>
          <Input id="rooms" type="number" min="1" max="5" value={rooms} onChange={e => setRooms(e.target.value)} />
        </div>
        <Button
          onClick={handleSearch}
          size="lg"
          disabled={!range?.from || !range?.to}
          className="w-full md:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Search className="mr-2 h-4 w-4" /> Search
        </Button>
      </div>
    </div>
  );
}

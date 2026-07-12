import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { addDays, format, isBefore, startOfToday } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronDown, Bed, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkUpdateDialog } from '@/components/admin/BulkUpdateDialog';
import {
  bulkUpdateInventory,
  getAdminCalendar,
  setRemainingAvailability,
  setRoomRate,
} from '@/services/api';
import type { AdminCalendarDay, AdminCalendarResponse, AdminCalendarRoom } from '@/types';

const DAY_WINDOW = 14;

const toDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const occupancyTone = (pct: number) =>
  pct >= 0.85 ? 'destructive' : pct >= 0.6 ? 'warning' : 'success';

export default function AdminCalendarPage() {
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(today);
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [calendar, setCalendar] = useState<AdminCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const startKey = format(startDate, 'yyyy-MM-dd');

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminCalendar({ start: startKey, days: DAY_WINDOW });
      setCalendar(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load availability.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [startKey]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const allRooms = calendar?.rooms ?? [];
  const rooms = roomFilter === 'all' ? allRooms : allRooms.filter(room => room.roomType.id === roomFilter);
  const bulkRooms = useMemo(() => (calendar?.rooms ?? []).map(room => room.roomType), [calendar?.rooms]);
  const dates = useMemo(() => (calendar?.dates ?? []).map(toDate), [calendar?.dates]);
  const dateColTemplate = `260px repeat(${DAY_WINDOW}, minmax(72px, 1fr))`;
  const canGoBack = startDate > today;
  const goBack = () => {
    const next = addDays(startDate, -DAY_WINDOW);
    setStartDate(next < today ? today : next);
  };

  const handleBulkSubmit = async (updates: {
    roomId: string;
    dates: string[];
    patch: { inventory?: number; status?: 'open' | 'closed' };
  }[]) => {
    await Promise.all(updates.map(update => bulkUpdateInventory(update.roomId, update.dates, update.patch)));
    await loadCalendar();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-title">Availability Center</h1>
          <p className="text-sm text-muted-foreground">Manage occupancy, inventory, and rates across your rooms</p>
        </div>
        <Button onClick={() => setBulkOpen(true)} disabled={loading || !calendar}>Bulk Update</Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setStartDate(today)}>Today</Button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              disabled={!canGoBack}
              aria-label="Previous range"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[220px] text-center">
              {dates.length ? `${format(dates[0], 'd MMM yyyy')} - ${format(dates[dates.length - 1], 'd MMM yyyy')}` : 'Loading...'}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setStartDate(d => addDays(d, DAY_WINDOW))} aria-label="Next range">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <div className="min-w-[200px]">
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rooms ({allRooms.length})</SelectItem>
                  {allRooms.map(({ roomType }) => (
                    <SelectItem key={roomType.id} value={roomType.id}>{roomType.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
            Loading availability...
          </div>
        )}

        {!loading && error && (
          <div className="py-16 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" onClick={() => void loadCalendar()}>Retry</Button>
          </div>
        )}

        {!loading && !error && calendar && (
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid border-b" style={{ gridTemplateColumns: dateColTemplate }}>
                <div className="p-2 text-xs font-semibold text-muted-foreground">Dates</div>
                {dates.map((d, i) => (
                  <div key={calendar.dates[i]} className={cn(
                    'p-2 text-center border-l',
                    (d.getDay() === 0 || d.getDay() === 6) && 'bg-muted/40',
                  )}>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{format(d, 'EEE')}</div>
                    <div className="text-xs font-medium">{format(d, 'MMM d')}</div>
                  </div>
                ))}
              </div>

              <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: dateColTemplate }}>
                <div className="p-3 text-sm font-medium">Room occupancy</div>
                {calendar.occupancy.map(day => {
                  const tone = occupancyTone(day.pct);
                  return (
                    <div key={day.date} className="p-2 border-l flex flex-col items-center justify-center gap-1">
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            tone === 'destructive' && 'bg-destructive',
                            tone === 'warning' && 'bg-warning',
                            tone === 'success' && 'bg-success',
                          )}
                          style={{ width: `${Math.round(day.pct * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{Math.round(day.pct * 100)}%</span>
                    </div>
                  );
                })}
              </div>

              {rooms.map(room => (
                <CalendarRoomRows
                  key={room.roomType.id}
                  room={room}
                  expanded={Boolean(expanded[room.roomType.id])}
                  onToggle={() => setExpanded(p => ({ ...p, [room.roomType.id]: !p[room.roomType.id] }))}
                  dateColTemplate={dateColTemplate}
                  today={today}
                  onSaved={loadCalendar}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-success" /> Low occupancy</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-warning" /> Filling up</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-destructive" /> Near full</span>
          <span className="ml-auto">Click a Rate cell to edit. Reflects on booking site instantly.</span>
        </div>
      </Card>

      <BulkUpdateDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        rooms={bulkRooms}
        onSubmit={handleBulkSubmit}
      />
    </div>
  );
}

function CalendarRoomRows({
  room,
  expanded,
  onToggle,
  dateColTemplate,
  today,
  onSaved,
}: {
  room: AdminCalendarRoom;
  expanded: boolean;
  onToggle: () => void;
  dateColTemplate: string;
  today: Date;
  onSaved: () => Promise<void>;
}) {
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full grid hover:bg-muted/30 transition-colors text-left"
        style={{ gridTemplateColumns: dateColTemplate }}
      >
        <div className="p-3 flex items-center gap-2">
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
          <Bed className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{room.roomType.name}</span>
        </div>
        {room.days.map(day => (
          <div key={day.date} className={cn(
            'p-2 text-center border-l text-xs font-medium',
            day.status === 'closed' ? 'text-muted-foreground italic' :
            day.remaining === 0 ? 'text-destructive' : day.remaining <= 1 ? 'text-warning' : 'text-muted-foreground',
          )}>
            {day.status === 'closed' ? '-' : day.remaining}
          </div>
        ))}
      </button>

      {expanded && (
        <>
          <div className="grid bg-card" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Net rooms booked</div>
            {room.days.map(day => (
              <div key={day.date} className="p-2 text-center border-l text-xs">
                {day.booked}
              </div>
            ))}
          </div>
          <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Remaining availability</div>
            {room.days.map(day => (
              <RemainingCell
                key={day.date}
                room={room}
                day={day}
                disabled={isBefore(toDate(day.date), today)}
                onSaved={onSaved}
              />
            ))}
          </div>
          <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Rate (Room Only)</div>
            {room.days.map(day => (
              <RateCell
                key={day.date}
                roomId={room.roomType.id}
                day={day}
                disabled={isBefore(toDate(day.date), today)}
                onSaved={onSaved}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RateCell({ roomId, day, disabled, onSaved }: {
  roomId: string;
  day: AdminCalendarDay;
  disabled?: boolean;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [val, setVal] = useState(String(day.rate));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(String(day.rate)); }, [day.rate]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = async () => {
    const rate = Math.max(0, Math.round(Number(val) || 0));
    setEditing(false);
    if (rate === day.rate) return;
    setSaving(true);
    try {
      await setRoomRate(roomId, day.date, rate);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update rate.');
      setVal(String(day.rate));
    } finally {
      setSaving(false);
    }
  };

  if (editing && !disabled) {
    return (
      <div className="p-1 text-center border-l">
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit();
            if (e.key === 'Escape') { setVal(String(day.rate)); setEditing(false); }
          }}
          className="w-full h-7 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || saving}
      onClick={() => setEditing(true)}
      className={cn(
        'p-2 text-center border-l text-xs font-medium w-full transition-colors',
        disabled ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-muted/50 cursor-text',
      )}
      title={disabled ? 'Past date' : 'Click to edit rate'}
    >
      {saving ? '...' : `$${day.rate}`}
    </button>
  );
}

function RemainingCell({ room, day, disabled, onSaved }: {
  room: AdminCalendarRoom;
  day: AdminCalendarDay;
  disabled?: boolean;
  onSaved: () => Promise<void>;
}) {
  const max = Math.max(0, room.roomType.inventoryCount - day.booked);
  const locked = disabled || day.status === 'closed';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [val, setVal] = useState(String(day.remaining));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(String(day.remaining)); }, [day.remaining]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = async () => {
    const remaining = Math.max(0, Math.round(Number(val) || 0));
    if (remaining > max) {
      toast.error(`You cannot add more rooms than inventory (${room.roomType.inventoryCount} max for ${room.roomType.name}).`);
      setVal(String(day.remaining));
      setEditing(false);
      return;
    }
    setEditing(false);
    if (remaining === day.remaining) return;
    setSaving(true);
    try {
      await setRemainingAvailability(room.roomType.id, day.date, remaining);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update remaining availability.');
      setVal(String(day.remaining));
    } finally {
      setSaving(false);
    }
  };

  if (editing && !locked) {
    return (
      <div className="p-1 text-center border-l">
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={max}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit();
            if (e.key === 'Escape') { setVal(String(day.remaining)); setEditing(false); }
          }}
          className="w-full h-7 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={locked || saving}
      onClick={() => setEditing(true)}
      className={cn(
        'p-2 text-center border-l text-xs font-medium w-full transition-colors',
        locked ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-muted/50 cursor-text',
      )}
      title={day.status === 'closed' ? 'Closed - reopen via Bulk Update' : disabled ? 'Past date' : `Click to edit (max ${max})`}
    >
      {day.status === 'closed' ? '-' : saving ? '...' : day.remaining}
    </button>
  );
}

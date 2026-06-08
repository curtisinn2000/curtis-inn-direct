import { useMemo, useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { addDays, format, startOfToday, isBefore } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronDown, Bed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkUpdateDialog } from '@/components/admin/BulkUpdateDialog';
import {
  useInventoryStore, getBooked, getRemaining, getRate, getStatus,
  getOccupancyForDate, occupancyTone, dateKey,
} from '@/store/inventoryStore';

const DAY_WINDOW = 14;

export default function AdminCalendarPage() {
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(today);
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);

  const state = useInventoryStore();
  const allRooms = Object.values(state.roomTypes).filter(r => r.isActive);
  const rooms = roomFilter === 'all' ? allRooms : allRooms.filter(r => r.id === roomFilter);

  const dates = useMemo(
    () => Array.from({ length: DAY_WINDOW }, (_, i) => addDays(startDate, i)),
    [startDate]
  );

  const dateColTemplate = `260px repeat(${DAY_WINDOW}, minmax(72px, 1fr))`;
  const canGoBack = startDate > today;
  const goBack = () => {
    const next = addDays(startDate, -DAY_WINDOW);
    setStartDate(next < today ? today : next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-title">Availability Center</h1>
          <p className="text-sm text-muted-foreground">Manage occupancy, inventory, and rates across your rooms</p>
        </div>
        <Button onClick={() => setBulkOpen(true)}>Bulk Update</Button>
      </div>

      <Card className="p-4 space-y-4">
        {/* Toolbar */}
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
              {format(dates[0], 'd MMM yyyy')} – {format(dates[dates.length - 1], 'd MMM yyyy')}
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
                  {allRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            {/* Header row */}
            <div className="grid border-b" style={{ gridTemplateColumns: dateColTemplate }}>
              <div className="p-2 text-xs font-semibold text-muted-foreground">Dates</div>
              {dates.map((d, i) => (
                <div key={i} className={cn(
                  'p-2 text-center border-l',
                  (d.getDay() === 0 || d.getDay() === 6) && 'bg-muted/40'
                )}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{format(d, 'EEE')}</div>
                  <div className="text-xs font-medium">{format(d, 'MMM d')}</div>
                </div>
              ))}
            </div>

            {/* Occupancy summary */}
            <div className="grid border-b bg-muted/20" style={{ gridTemplateColumns: dateColTemplate }}>
              <div className="p-3 text-sm font-medium">Room occupancy</div>
              {dates.map((d, i) => {
                const o = getOccupancyForDate(state, allRooms.map(r => r.id), d);
                const tone = occupancyTone(o.pct);
                return (
                  <div key={i} className="p-2 border-l flex flex-col items-center justify-center gap-1">
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          tone === 'destructive' && 'bg-destructive',
                          tone === 'warning' && 'bg-warning',
                          tone === 'success' && 'bg-success',
                        )}
                        style={{ width: `${Math.round(o.pct * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{Math.round(o.pct * 100)}%</span>
                  </div>
                );
              })}
            </div>

            {/* Rooms */}
            {rooms.map(room => {
              const isOpen = expanded[room.id];
              return (
                <div key={room.id} className="border-b last:border-b-0">
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [room.id]: !p[room.id] }))}
                    className="w-full grid hover:bg-muted/30 transition-colors text-left"
                    style={{ gridTemplateColumns: dateColTemplate }}
                  >
                    <div className="p-3 flex items-center gap-2">
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !isOpen && '-rotate-90')} />
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{room.name}</span>
                    </div>
                    {dates.map((d, i) => {
                      const status = getStatus(state, room.id, d);
                      const avail = getRemaining(state, room.id, d);
                      return (
                        <div key={i} className={cn(
                          'p-2 text-center border-l text-xs font-medium',
                          status === 'closed' ? 'text-muted-foreground italic' :
                          avail === 0 ? 'text-destructive' : avail <= 1 ? 'text-warning' : 'text-muted-foreground'
                        )}>
                          {status === 'closed' ? '—' : avail}
                        </div>
                      );
                    })}
                  </button>

                  {isOpen && (
                    <>
                      <div className="grid bg-card" style={{ gridTemplateColumns: dateColTemplate }}>
                        <div className="p-2 pl-10 text-xs text-muted-foreground">Net rooms booked</div>
                        {dates.map((d, i) => (
                          <div key={i} className="p-2 text-center border-l text-xs">
                            {getBooked(state, room.id, d)}
                          </div>
                        ))}
                      </div>
                      <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
                        <div className="p-2 pl-10 text-xs text-muted-foreground">Remaining availability</div>
                        {dates.map((d, i) => (
                          <RemainingCell key={i} roomId={room.id} date={d} disabled={isBefore(d, today)} />
                        ))}
                      </div>
                      <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
                        <div className="p-2 pl-10 text-xs text-muted-foreground">Rate (Room Only)</div>
                        {dates.map((d, i) => (
                          <RateCell key={i} roomId={room.id} date={d} disabled={isBefore(d, today)} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-success" /> Low occupancy</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-warning" /> Filling up</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-destructive" /> Near full</span>
          <span className="ml-auto">Click a Rate cell to edit. Reflects on booking site instantly.</span>
        </div>
      </Card>

      <BulkUpdateDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </div>
  );
}

function RateCell({ roomId, date, disabled }: { roomId: string; date: Date; disabled?: boolean }) {
  const state = useInventoryStore();
  const setRate = useInventoryStore(s => s.setRate);
  const rate = getRate(state, roomId, date);
  const isOverridden = !!state.overrides[`${roomId}|${dateKey(date)}`]?.rate;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(rate));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(String(rate)); }, [rate]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const n = Math.max(0, Math.round(Number(val) || 0));
    if (n !== rate) setRate(roomId, date, n);
    setEditing(false);
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
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setVal(String(rate)); setEditing(false); }
          }}
          className="w-full h-7 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setEditing(true)}
      className={cn(
        'p-2 text-center border-l text-xs font-medium w-full transition-colors',
        disabled ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-muted/50 cursor-text',
        isOverridden && !disabled && 'text-primary',
      )}
      title={disabled ? 'Past date' : 'Click to edit rate'}
    >
      ${rate}
    </button>
  );
}

function RemainingCell({ roomId, date, disabled }: { roomId: string; date: Date; disabled?: boolean }) {
  const state = useInventoryStore();
  const setRemaining = useInventoryStore(s => s.setRemaining);
  const room = state.roomTypes[roomId];
  const status = getStatus(state, roomId, date);
  const booked = getBooked(state, roomId, date);
  const remaining = getRemaining(state, roomId, date);
  const max = Math.max(0, (room?.baseInventory ?? 0) - booked);
  const isOverridden = state.overrides[`${roomId}|${dateKey(date)}`]?.inventory != null;
  const isClosed = status === 'closed';
  const locked = disabled || isClosed;

  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(remaining));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(String(remaining)); }, [remaining]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const n = Math.max(0, Math.round(Number(val) || 0));
    if (n > max) {
      toast.error(`You cannot add more rooms than inventory (${room?.baseInventory ?? 0} max for ${room?.name ?? 'this room'}).`);
      setVal(String(remaining));
      setEditing(false);
      return;
    }
    if (n !== remaining) setRemaining(roomId, date, n);
    setEditing(false);
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
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setVal(String(remaining)); setEditing(false); }
          }}
          className="w-full h-7 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => setEditing(true)}
      className={cn(
        'p-2 text-center border-l text-xs font-medium w-full transition-colors',
        locked ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-muted/50 cursor-text',
        isOverridden && !locked && 'text-primary',
      )}
      title={isClosed ? 'Closed — reopen via Bulk Update' : disabled ? 'Past date' : `Click to edit (max ${max})`}
    >
      {isClosed ? '—' : remaining}
    </button>
  );
}

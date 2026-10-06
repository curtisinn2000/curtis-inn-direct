import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { addDays, format, isBefore, startOfToday } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronDown, Bed, Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BulkUpdateDialog } from '@/components/admin/BulkUpdateDialog';
import {
  bulkUpdateInventory,
  getAdminCalendar,
  setDailyInventory,
  setRoomRate,
  setInventoryStatus,
} from '@/services/api';
import type { AdminCalendarDay, AdminCalendarResponse, AdminCalendarRoom } from '@/types';
import { useAdminSession, hasAdminPermission } from '@/contexts/AdminSessionContext';
import { ADMIN_PERMISSIONS } from '@/config/adminPermissions';
import { inventoryValidationMessage } from '@/lib/inventory';

const DAY_WINDOW = 14;

const toDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const occupancyTone = (pct: number) =>
  pct >= 0.85 ? 'destructive' : pct >= 0.6 ? 'warning' : 'success';

type CalendarApiError = Error & { details?: { currentDay?: AdminCalendarDay } };

function currentDayFromError(error: unknown): AdminCalendarDay | null {
  if (!(error instanceof Error)) return null;
  return (error as CalendarApiError).details?.currentDay ?? null;
}

function replaceCalendarDay(
  calendar: AdminCalendarResponse,
  roomId: string,
  saved: AdminCalendarDay,
): AdminCalendarResponse {
  const previous = calendar.rooms.find(room => room.roomType.id === roomId)?.days.find(day => day.date === saved.date);
  const inventoryDelta = saved.inventory - (previous?.inventory ?? saved.inventory);
  return {
    ...calendar,
    rooms: calendar.rooms.map(room => room.roomType.id !== roomId ? room : {
      ...room,
      days: room.days.map(day => day.date === saved.date ? saved : day),
    }),
    occupancy: calendar.occupancy.map(day => {
      if (day.date !== saved.date) return day;
      const total = Math.max(0, day.total + inventoryDelta);
      return { ...day, total, pct: total ? day.booked / total : 0 };
    }),
  };
}

export default function AdminCalendarPage() {
  const { user } = useAdminSession();
  const today = startOfToday();
  const [startDate, setStartDate] = useState<Date>(today);
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [calendar, setCalendar] = useState<AdminCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingStatuses, setSavingStatuses] = useState<Set<string>>(() => new Set());
  const canManageAvailability = hasAdminPermission(user, ADMIN_PERMISSIONS.availabilityManage);
  const canManageRates = hasAdminPermission(user, ADMIN_PERMISSIONS.ratesManage);

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

  const handleStatusChange = async (roomId: string, day: AdminCalendarDay) => {
    if (!calendar || !canManageAvailability) return;
    const key = `${roomId}|${day.date}`;
    if (savingStatuses.has(key)) return;
    const nextStatus = day.status === 'open' ? 'closed' : 'open';
    const previousState = day.availabilityState;
    const optimisticDay: AdminCalendarDay = {
      ...day,
      status: nextStatus,
      sellableRemaining: nextStatus === 'closed' ? 0 : day.remaining,
      availabilityState: nextStatus === 'closed' ? 'closed' : day.remaining === 0 ? 'sold_out' : 'open',
    };
    setSavingStatuses(current => new Set(current).add(key));
    setCalendar(current => current ? replaceCalendarDay(current, roomId, optimisticDay) : current);
    try {
      const saved = await setInventoryStatus({
        roomId,
        date: day.date,
        status: nextStatus,
        expectedStatus: day.status,
        expectedUpdatedAt: day.updatedAt,
      });
      setCalendar(current => current ? replaceCalendarDay(current, roomId, saved) : current);
      toast.success(
        nextStatus === 'open'
          ? 'Room opened for sale.'
          : previousState === 'sold_out'
            ? 'Sold-out date closed for sale.'
            : 'Room closed for sale.',
      );
    } catch (err) {
      const currentDay = currentDayFromError(err);
      setCalendar(current => current ? replaceCalendarDay(current, roomId, currentDay ?? day) : current);
      toast.error(err instanceof Error ? err.message : 'Unable to update availability.');
    } finally {
      setSavingStatuses(current => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const handleDaySaved = (roomId: string, saved: AdminCalendarDay) => {
    setCalendar(current => {
      if (!current) return current;
      return replaceCalendarDay(current, roomId, saved);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-title">Availability Center</h1>
          <p className="text-sm text-muted-foreground">Manage occupancy, inventory, and rates across your rooms</p>
        </div>
        {canManageAvailability && <Button onClick={() => setBulkOpen(true)} disabled={loading || !calendar}>Bulk Update</Button>}
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
              {dates.length ? `${format(dates[0], 'd MMM yyyy')} to ${format(dates[dates.length - 1], 'd MMM yyyy')}` : 'Loading...'}
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
                  canManageAvailability={canManageAvailability}
                  canManageRates={canManageRates}
                  savingStatuses={savingStatuses}
                  onStatusChange={day => void handleStatusChange(room.roomType.id, day)}
                  onDaySaved={saved => handleDaySaved(room.roomType.id, saved)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-success" /> Low occupancy</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-warning" /> Filling up</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-destructive" /> Near full</span>
          <span className="ml-auto">Green dates are open, red dates are manually closed, and yellow dates are sold out.</span>
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
  canManageAvailability,
  canManageRates,
  savingStatuses,
  onStatusChange,
  onDaySaved,
}: {
  room: AdminCalendarRoom;
  expanded: boolean;
  onToggle: () => void;
  dateColTemplate: string;
  today: Date;
  onSaved: () => Promise<void>;
  canManageAvailability: boolean;
  canManageRates: boolean;
  savingStatuses: Set<string>;
  onStatusChange: (day: AdminCalendarDay) => void;
  onDaySaved: (day: AdminCalendarDay) => void;
}) {
  return (
    <div className="border-b last:border-b-0">
      <div className="w-full grid hover:bg-muted/20 transition-colors" style={{ gridTemplateColumns: dateColTemplate }}>
        <button onClick={onToggle} className="p-3 flex items-center gap-2 text-left">
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
          <Bed className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{room.roomType.name}</span>
        </button>
        {room.days.map(day => (
          <AvailabilityCell key={day.date} day={day} disabled={!canManageAvailability || isBefore(toDate(day.date), today)} saving={savingStatuses.has(`${room.roomType.id}|${day.date}`)} onClick={() => onStatusChange(day)} />
        ))}
      </div>

      {expanded && (
        <>
          <div className="grid bg-card" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Inventory</div>
            {room.days.map(day => (
              <InventoryCell
                key={day.date}
                room={room}
                day={day}
                disabled={!canManageAvailability || isBefore(toDate(day.date), today)}
                onSaved={onDaySaved}
              />
            ))}
          </div>
          <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Net rooms booked</div>
            {room.days.map(day => (
              <div key={day.date} className="p-2 text-center border-l text-xs">
                {day.booked}
              </div>
            ))}
          </div>
          <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Remaining availability</div>
            {room.days.map(day => <div key={day.date} className="p-2 text-center border-l text-xs">{day.remaining}</div>)}
          </div>
          <div className="grid bg-card border-t" style={{ gridTemplateColumns: dateColTemplate }}>
            <div className="p-2 pl-10 text-xs text-muted-foreground">Rate (Room Only)</div>
            {room.days.map(day => (
              <RateCell
                key={day.date}
                roomId={room.roomType.id}
                day={day}
                disabled={!canManageRates || isBefore(toDate(day.date), today)}
                onSaved={onSaved}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AvailabilityCell({ day, disabled, saving, onClick }: { day: AdminCalendarDay; disabled: boolean; saving: boolean; onClick: () => void }) {
  const soldOut = day.availabilityState === 'sold_out';
  const closed = day.availabilityState === 'closed';
  return (
    <button type="button" disabled={disabled || saving} onClick={onClick} className={cn(
      'm-1.5 min-h-9 rounded-md border flex items-center justify-center gap-1 text-[10px] font-semibold transition-colors',
      day.availabilityState === 'open' && 'border-success/40 bg-success/15 text-success hover:bg-success/25',
      closed && 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20',
      soldOut && 'border-warning/50 bg-warning/15 text-warning hover:bg-warning/25',
      disabled && 'opacity-55 cursor-not-allowed',
    )} title={soldOut ? 'Sold out. Click to close this date for sale.' : closed ? 'Click to reopen' : 'Click to close'}>
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : soldOut ? <AlertTriangle className="h-3.5 w-3.5" /> : closed ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      {soldOut ? 'Sold out' : closed ? 'Closed' : 'Open'}
    </button>
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

function InventoryCell({ room, day, disabled, onSaved }: {
  room: AdminCalendarRoom;
  day: AdminCalendarDay;
  disabled?: boolean;
  onSaved: (day: AdminCalendarDay) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [val, setVal] = useState(String(day.inventory));
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelBlurRef = useRef(false);

  useEffect(() => { setVal(String(day.inventory)); }, [day.inventory]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = async () => {
    const validationError = inventoryValidationMessage(val, day.booked);
    if (validationError) {
      toast.error(validationError);
      setVal(String(day.inventory));
      setEditing(false);
      return;
    }
    const inventory = Number(val);
    setEditing(false);
    if (inventory === day.inventory) return;
    setSaving(true);
    try {
      const saved = await setDailyInventory({
        roomId: room.roomType.id,
        date: day.date,
        inventory,
        expectedInventory: day.inventory,
        expectedUpdatedAt: day.updatedAt,
      });
      setVal(String(saved.inventory));
      onSaved(saved);
      toast.success('Inventory updated.');
    } catch (error) {
      const currentDay = currentDayFromError(error);
      if (currentDay) {
        setVal(String(currentDay.inventory));
        onSaved(currentDay);
      } else {
        setVal(String(day.inventory));
      }
      toast.error(error instanceof Error ? error.message : 'Unable to update inventory.');
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
          min={day.booked}
          max={999}
          step={1}
          inputMode="numeric"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => {
            if (cancelBlurRef.current) {
              cancelBlurRef.current = false;
              return;
            }
            void commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelBlurRef.current = true;
              setVal(String(day.inventory));
              setEditing(false);
            }
          }}
          aria-label={`Inventory for ${room.roomType.name} on ${day.date}`}
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
      title={disabled ? 'Past date or insufficient permission' : `Click to edit inventory (${day.booked} to 999)`}
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : day.inventory}
    </button>
  );
}

import { useEffect, useState } from 'react';
import { format, addDays, addYears, differenceInCalendarDays, getDay, startOfToday } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check, Pencil, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateKey } from '@/store/inventoryStore';
import { useToast } from '@/hooks/use-toast';
import type { RoomType } from '@/types';

type Step = 'dates' | 'updates' | 'review';
type ChangeMode = 'no_change' | 'open' | 'close';
interface RoomUpdate { inventory: string; mode: ChangeMode; }

const WEEKDAYS = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
];

interface BulkUpdatePayload {
  roomId: string;
  dates: string[];
  patch: { inventory?: number; status?: 'open' | 'closed' };
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rooms: RoomType[];
  onSubmit: (updates: BulkUpdatePayload[]) => Promise<void>;
}

export function BulkUpdateDialog({ open, onOpenChange, rooms, onSubmit }: Props) {
  const { toast } = useToast();
  const today = startOfToday();

  const [step, setStep] = useState<Step>('dates');
  const [range, setRange] = useState<DateRange | undefined>();
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [updates, setUpdates] = useState<Record<string, RoomUpdate>>(
    () => Object.fromEntries(rooms.map(r => [r.id, { inventory: '', mode: 'no_change' as ChangeMode }]))
  );

  useEffect(() => {
    if (open) {
      setUpdates(Object.fromEntries(rooms.map(r => [r.id, { inventory: '', mode: 'no_change' as ChangeMode }])));
    }
  }, [open, rooms]);

  const reset = () => {
    setStep('dates'); setRange(undefined); setDays([0,1,2,3,4,5,6]);
    setUpdates(Object.fromEntries(rooms.map(r => [r.id, { inventory: '', mode: 'no_change' as ChangeMode }])));
  };

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const selectedDates: Date[] = range?.from && range?.to
    ? Array.from({ length: differenceInCalendarDays(range.to, range.from) + 1 })
        .map((_, i) => addDays(range.from!, i))
        .filter(d => days.includes(getDay(d)))
    : [];
  const daysCount = selectedDates.length;

  const inventoryError = (roomId: string, value: string): string | null => {
    if (value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 'Must be 0 or more';
    const base = rooms.find(room => room.id === roomId)?.inventoryCount ?? 0;
    if (n > base) return `Max ${base} (set in Rooms)`;
    return null;
  };

  const activeUpdates = Object.entries(updates).filter(([_, u]) => u.inventory !== '' || u.mode !== 'no_change');
  const hasInventoryErrors = Object.entries(updates).some(([id, u]) => !!inventoryError(id, u.inventory));
  const canNextDates = !!(range?.from && range?.to && daysCount > 0);
  const canPreview = activeUpdates.length > 0 && !hasInventoryErrors;

  const submit = async () => {
    const keys = selectedDates.map(dateKey);
    const payload: BulkUpdatePayload[] = [];
    for (const [id, u] of activeUpdates) {
      const patch: { inventory?: number; status?: 'open' | 'closed' } = {};
      if (u.inventory !== '') patch.inventory = Number(u.inventory);
      if (u.mode === 'open') patch.status = 'open';
      if (u.mode === 'close') patch.status = 'closed';
      payload.push({ roomId: id, dates: keys, patch });
    }
    try {
      await onSubmit(payload);
      toast({ title: 'Availability updated', description: `${activeUpdates.length} room type(s) updated across ${daysCount} day(s).` });
      close(false);
    } catch (error) {
      toast({
        title: 'Unable to update availability',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Bulk Update Availability</DialogTitle>
          <DialogDescription>You can make changes for dates up to 2 years from today.</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(['dates','updates','review'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn('px-2 py-0.5 rounded-full border', step === s ? 'border-primary text-primary font-medium' : 'border-border')}>
                {i+1}. {s === 'dates' ? 'Select Dates' : s === 'updates' ? 'Select Updates' : 'Review'}
              </span>
              {i < 2 && <ChevronRight className="h-3 w-3" />}
            </div>
          ))}
        </div>

        {step === 'dates' && (
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm">Select Dates</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Choose a date range (past dates are disabled)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    min={format(today, 'yyyy-MM-dd')}
                    max={format(addYears(today, 2), 'yyyy-MM-dd')}
                    value={range?.from ? format(range.from, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) { setRange(p => ({ from: undefined, to: p?.to })); return; }
                      const [y, m, d] = v.split('-').map(Number);
                      const nd = new Date(y, m - 1, d);
                      setRange(p => {
                        const to = p?.to;
                        if (to && nd > to) return { from: to, to: nd };
                        return { from: nd, to };
                      });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    min={format(range?.from ?? today, 'yyyy-MM-dd')}
                    max={format(addYears(today, 2), 'yyyy-MM-dd')}
                    value={range?.to ? format(range.to, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) { setRange(p => ({ from: p?.from, to: undefined })); return; }
                      const [y, m, d] = v.split('-').map(Number);
                      const nd = new Date(y, m - 1, d);
                      setRange(p => {
                        const from = p?.from;
                        if (from && nd < from) return { from: nd, to: from };
                        return { from, to: nd };
                      });
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map(d => (
                  <label key={d.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={days.includes(d.value)} onCheckedChange={(c) => setDays(p => c ? [...p, d.value] : p.filter(x => x !== d.value))} />
                    {d.label}
                  </label>
                ))}
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Review/refine your dates</p>
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={2}
                  disabled={(d) => d < today || d > addYears(today, 2)}
                  className="pointer-events-auto"
                />
                {daysCount > 0 && <p className="text-xs text-muted-foreground mt-2">{daysCount} day(s) will be updated</p>}
              </div>
            </Card>
            <div className="flex justify-end">
              <Button onClick={() => setStep('updates')} disabled={!canNextDates}>Next Section</Button>
            </div>
          </div>
        )}

        {step === 'updates' && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <h3 className="font-semibold text-sm text-success">Date Range</h3>
                </div>
                <button onClick={() => setStep('dates')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </div>
              <p className="text-sm mt-1">{format(range!.from!, 'MMM dd, yyyy')} – {format(range!.to!, 'MMM dd, yyyy')}</p>
              <p className="text-xs text-muted-foreground">{daysCount} days will be updated</p>
            </Card>

            <Card className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm">Select Updates</h3>
                <p className="text-xs text-muted-foreground mt-0.5">No changes are made to fields left blank. Inventory is capped by the value set on the Rooms page.</p>
              </div>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {rooms.map(r => {
                  const err = inventoryError(r.id, updates[r.id].inventory);
                  return (
                    <div key={r.id} className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">Base inventory: {r.inventoryCount}</p>
                      </div>
                      <div className="grid grid-cols-[1fr_1fr] gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Inventory (max {r.inventoryCount})</Label>
                          <Input
                            type="number" min={0} max={r.inventoryCount} placeholder=""
                            value={updates[r.id].inventory}
                            onChange={(e) => setUpdates(p => ({ ...p, [r.id]: { ...p[r.id], inventory: e.target.value }}))}
                            className={cn(err && 'border-destructive focus-visible:ring-destructive')}
                          />
                          {err && <p className="text-[11px] text-destructive mt-1">{err}</p>}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Availability</Label>
                          <Select
                            value={updates[r.id].mode}
                            onValueChange={(v: ChangeMode) => setUpdates(p => ({ ...p, [r.id]: { ...p[r.id], mode: v }}))}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no_change">No Change</SelectItem>
                              <SelectItem value="close">Close</SelectItem>
                              <SelectItem value="open">Open</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('dates')}>Back</Button>
              <Button onClick={() => setStep('review')} disabled={!canPreview}>Preview Section</Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <h3 className="font-semibold text-sm text-success">Date Range</h3>
                </div>
                <button onClick={() => setStep('dates')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </div>
              <p className="text-sm mt-1">{format(range!.from!, 'MMM dd, yyyy')} – {format(range!.to!, 'MMM dd, yyyy')}</p>
              <p className="text-xs text-muted-foreground">{daysCount} days will be updated</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <h3 className="font-semibold text-sm text-success">Update</h3>
                </div>
                <button onClick={() => setStep('updates')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </div>
              <div className="divide-y">
                {activeUpdates.map(([id, u]) => {
                  const room = rooms.find(r => r.id === id)!;
                  return (
                    <div key={id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{room.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.inventory !== '' && `Inventory: ${u.inventory}`}
                          {u.inventory !== '' && u.mode !== 'no_change' && ' · '}
                          {u.mode !== 'no_change' && `Availability: ${u.mode === 'open' ? 'Open' : 'Close'}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <span>All submitted updates are final and cannot be undone.</span>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('updates')}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>Reset</Button>
                <Button onClick={submit}>Submit</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

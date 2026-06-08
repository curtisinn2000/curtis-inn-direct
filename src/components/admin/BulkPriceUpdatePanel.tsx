import { useState } from 'react';
import { format, addDays, addYears, differenceInCalendarDays, getDay, startOfToday } from 'date-fns';
import type { DateRange } from 'react-day-picker';
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
import { useInventoryStore, dateKey, getRate, type RateRule } from '@/store/inventoryStore';
import { useToast } from '@/hooks/use-toast';

type Step = 'dates' | 'updates' | 'review';
type Mode = 'no_change' | 'set' | 'pct' | 'amt';
interface RoomUpdate { mode: Mode; value: string; }

const WEEKDAYS = [
  { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 },
];

const MODE_LABEL: Record<Exclude<Mode, 'no_change'>, string> = {
  set: 'Set to amount', pct: 'Adjust by %', amt: 'Adjust by $',
};

const applyRule = (current: number, mode: Mode, raw: string): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return current;
  let v = current;
  if (mode === 'set') v = n;
  else if (mode === 'pct') v = current * (1 + n / 100);
  else if (mode === 'amt') v = current + n;
  return Math.max(0, Math.min(9999, Math.round(v)));
};

export function BulkPriceUpdatePanel() {
  const { toast } = useToast();
  const today = startOfToday();
  const roomTypes = useInventoryStore(s => s.roomTypes);
  const bulkUpdateRates = useInventoryStore(s => s.bulkUpdateRates);
  const rooms = Object.values(roomTypes).filter(r => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const initialUpdates = () => Object.fromEntries(rooms.map(r => [r.id, { mode: 'no_change' as Mode, value: '' }]));
  const [step, setStep] = useState<Step>('dates');
  const [range, setRange] = useState<DateRange | undefined>();
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [updates, setUpdates] = useState<Record<string, RoomUpdate>>(initialUpdates);

  const reset = () => {
    setStep('dates'); setRange(undefined); setDays([0,1,2,3,4,5,6]);
    setUpdates(initialUpdates());
  };

  const selectedDates: Date[] = range?.from && range?.to
    ? Array.from({ length: differenceInCalendarDays(range.to, range.from) + 1 })
        .map((_, i) => addDays(range.from!, i))
        .filter(d => days.includes(getDay(d)))
    : [];
  const daysCount = selectedDates.length;

  const rowError = (mode: Mode, value: string): string | null => {
    if (mode === 'no_change') return null;
    if (value === '') return 'Enter a value';
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Invalid number';
    if (mode === 'set' && n < 0) return 'Must be 0 or more';
    if (mode === 'set' && n > 9999) return 'Max $9999';
    return null;
  };

  const activeUpdates = Object.entries(updates).filter(([_, u]) => u.mode !== 'no_change');
  const hasErrors = activeUpdates.some(([_, u]) => !!rowError(u.mode, u.value));
  const canNextDates = !!(range?.from && range?.to && daysCount > 0);
  const canPreview = activeUpdates.length > 0 && !hasErrors;

  const submit = () => {
    const keys = selectedDates.map(dateKey);
    for (const [id, u] of activeUpdates) {
      const n = Number(u.value);
      const rule: RateRule = u.mode === 'set' ? { kind: 'set', amount: n }
        : u.mode === 'pct' ? { kind: 'pct', delta: n }
        : { kind: 'amt', delta: n };
      bulkUpdateRates(id, keys, rule);
    }
    toast({ title: 'Prices updated', description: `${activeUpdates.length} room type(s) updated across ${daysCount} day(s).` });
    reset();
  };

  return (
    <div className="space-y-4">
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
                <Input readOnly value={range?.from ? format(range.from, 'MM/dd/yyyy') : ''} placeholder="mm/dd/yyyy" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input readOnly value={range?.to ? format(range.to, 'MM/dd/yyyy') : ''} placeholder="mm/dd/yyyy" />
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
              <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} disabled={(d) => d < today || d > addYears(today, 2)} className="pointer-events-auto" />
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
              <h3 className="font-semibold text-sm">Select Price Updates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">No changes are made to rooms left on "No change". Final price is clamped to $0–$9999.</p>
            </div>
            <div className="space-y-4">
              {rooms.map(r => {
                const u = updates[r.id];
                const err = rowError(u.mode, u.value);
                const currentTodayRate = getRate(useInventoryStore.getState(), r.id, today);
                const preview = u.mode === 'no_change' || u.value === '' || err
                  ? null
                  : applyRule(currentTodayRate, u.mode, u.value);
                return (
                  <div key={r.id} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">Base: ${r.basePrice} · Today: ${currentTodayRate}</p>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr] gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Change type</Label>
                        <Select
                          value={u.mode}
                          onValueChange={(v: Mode) => setUpdates(p => ({ ...p, [r.id]: { ...p[r.id], mode: v }}))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no_change">No Change</SelectItem>
                            <SelectItem value="set">{MODE_LABEL.set}</SelectItem>
                            <SelectItem value="pct">{MODE_LABEL.pct}</SelectItem>
                            <SelectItem value="amt">{MODE_LABEL.amt}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {u.mode === 'no_change' ? 'Value' : u.mode === 'pct' ? 'Percent (e.g. 10 or -5)' : u.mode === 'amt' ? 'Amount ($, e.g. 15 or -10)' : 'New price ($)'}
                        </Label>
                        <Input
                          type="number"
                          disabled={u.mode === 'no_change'}
                          placeholder={u.mode === 'no_change' ? '—' : u.mode === 'set' ? '129' : u.mode === 'pct' ? '10' : '15'}
                          value={u.value}
                          onChange={(e) => setUpdates(p => ({ ...p, [r.id]: { ...p[r.id], value: e.target.value }}))}
                          className={cn(err && 'border-destructive focus-visible:ring-destructive')}
                        />
                        {err ? <p className="text-[11px] text-destructive mt-1">{err}</p>
                          : preview != null && <p className="text-[11px] text-muted-foreground mt-1">Preview today: ${preview}</p>}
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
                <h3 className="font-semibold text-sm text-success">Price Update</h3>
              </div>
              <button onClick={() => setStep('updates')} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="divide-y">
              {activeUpdates.map(([id, u]) => {
                const room = rooms.find(r => r.id === id)!;
                const desc = u.mode === 'set' ? `Set to $${u.value}`
                  : u.mode === 'pct' ? `${Number(u.value) >= 0 ? '+' : ''}${u.value}%`
                  : `${Number(u.value) >= 0 ? '+' : ''}$${u.value}`;
                return (
                  <div key={id} className="py-2 flex items-center justify-between text-sm">
                    <p className="font-medium">{room.name}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <span>All submitted updates are final and override existing per-date rates.</span>
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
    </div>
  );
}

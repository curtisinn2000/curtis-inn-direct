import { useMemo, useState } from 'react';
import { format, addDays, addYears, differenceInCalendarDays, getDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check, Pencil, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { bulkUpdateRates } from '@/services/api';
import type { RoomType } from '@/types';
import { dateFromKey, hotelTodayKey } from '@/lib/bookingDates';

type Step = 'dates' | 'updates' | 'review';

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

interface Props {
  rooms: RoomType[];
}

export function BulkPriceUpdatePanel({ rooms }: Props) {
  const { toast } = useToast();
  const today = dateFromKey(hotelTodayKey());

  const initialUpdates = () => Object.fromEntries(rooms.map(room => [room.id, '']));
  const [step, setStep] = useState<Step>('dates');
  const [range, setRange] = useState<DateRange | undefined>();
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [updates, setUpdates] = useState<Record<string, string>>(initialUpdates);
  const [submitting, setSubmitting] = useState(false);

  const selectedDates: Date[] = useMemo(() => {
    if (!range?.from || !range?.to) return [];
    return Array.from({ length: differenceInCalendarDays(range.to, range.from) + 1 })
      .map((_, index) => addDays(range.from!, index))
      .filter(date => days.includes(getDay(date)));
  }, [days, range]);

  const daysCount = selectedDates.length;
  const activeUpdates = Object.entries(updates).filter(([, value]) => value.trim() !== '');
  const hasErrors = activeUpdates.some(([, value]) => Boolean(rateError(value)));
  const canNextDates = Boolean(range?.from && range?.to && daysCount > 0);
  const canPreview = activeUpdates.length > 0 && !hasErrors;

  const reset = () => {
    setStep('dates');
    setRange(undefined);
    setDays([0, 1, 2, 3, 4, 5, 6]);
    setUpdates(initialUpdates());
  };

  const submit = async () => {
    const keys = selectedDates.map(toDateKey);
    setSubmitting(true);
    try {
      await Promise.all(activeUpdates.map(([roomId, value]) => bulkUpdateRates(roomId, keys, Math.round(Number(value)))));
      toast({
        title: 'Prices updated',
        description: `${activeUpdates.length} room type(s) updated across ${daysCount} day(s).`,
      });
      reset();
    } catch (err) {
      toast({
        title: 'Unable to update prices',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (rooms.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        No active room types are available for rate updates.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {(['dates', 'updates', 'review'] as Step[]).map((item, index) => (
          <div key={item} className="flex items-center gap-2">
            <span className={cn('px-2 py-0.5 rounded-full border', step === item ? 'border-primary text-primary font-medium' : 'border-border')}>
              {index + 1}. {item === 'dates' ? 'Select Dates' : item === 'updates' ? 'Set Rates' : 'Review'}
            </span>
            {index < 2 && <ChevronRight className="h-3 w-3" />}
          </div>
        ))}
      </div>

      {step === 'dates' && (
        <div className="space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm">Select Dates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Choose a future date range, then optionally limit it by weekday.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              {WEEKDAYS.map(day => (
                <label key={day.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={days.includes(day.value)} onCheckedChange={checked => setDays(current => checked === true ? [...new Set([...current, day.value])] : current.filter(value => value !== day.value))} />
                  {day.label}
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
                disabled={date => date < today || date > addYears(today, 2)}
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
          <SummaryCard
            title="Date Range"
            detail={`${format(range!.from!, 'MMM dd, yyyy')} to ${format(range!.to!, 'MMM dd, yyyy')}`}
            subdetail={`${daysCount} days will be updated`}
            onEdit={() => setStep('dates')}
          />

          <Card className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm">Set Nightly Rates</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Enter the room-only nightly price. Blank rooms are left unchanged.</p>
            </div>
            <div className="space-y-4">
              {rooms.map(room => {
                const value = updates[room.id] ?? '';
                const error = value.trim() ? rateError(value) : null;
                return (
                  <div key={room.id} className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-start">
                    <div>
                      <p className="font-medium text-sm">{room.name}</p>
                      <p className="text-xs text-muted-foreground">Base rate: ${room.basePrice}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nightly rate ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={9999}
                        placeholder="No change"
                        value={value}
                        onChange={event => setUpdates(current => ({ ...current, [room.id]: event.target.value }))}
                        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
                      />
                      {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
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
          <SummaryCard
            title="Date Range"
            detail={`${format(range!.from!, 'MMM dd, yyyy')} to ${format(range!.to!, 'MMM dd, yyyy')}`}
            subdetail={`${daysCount} days will be updated`}
            onEdit={() => setStep('dates')}
          />

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <h3 className="font-semibold text-sm text-success">Rate Updates</h3>
              </div>
              <button onClick={() => setStep('updates')} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>
            <div className="divide-y">
              {activeUpdates.map(([roomId, value]) => {
                const room = rooms.find(item => item.id === roomId)!;
                return (
                  <div key={roomId} className="py-2 flex items-center justify-between text-sm">
                    <p className="font-medium">{room.name}</p>
                    <p className="text-xs text-muted-foreground">Set to ${Math.round(Number(value))}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <span>Submitted rates override existing per-date rates and will be used by Availability Center and public booking.</span>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('updates')} disabled={submitting}>Back</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={submitting}>Reset</Button>
              <Button onClick={() => void submit()} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function rateError(value: string): string | null {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 'Invalid number';
  if (rate < 0) return 'Must be 0 or more';
  if (rate > 9999) return 'Max $9999';
  return null;
}

function SummaryCard({
  title,
  detail,
  subdetail,
  onEdit,
}: {
  title: string;
  detail: string;
  subdetail: string;
  onEdit: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-success" />
          <h3 className="font-semibold text-sm text-success">{title}</h3>
        </div>
        <button onClick={onEdit} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      <p className="text-sm mt-1">{detail}</p>
      <p className="text-xs text-muted-foreground">{subdetail}</p>
    </Card>
  );
}

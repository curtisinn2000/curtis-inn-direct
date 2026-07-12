import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BulkPriceUpdatePanel } from '@/components/admin/BulkPriceUpdatePanel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clearRoomRates, getAdminRoomTypes } from '@/services/api';
import type { RoomType } from '@/types';
import { dateFromKey, hotelTodayKey } from '@/lib/bookingDates';
import { Eraser, Loader2 } from 'lucide-react';

export default function AdminRatesPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [open, setOpen] = useState(false);

  const activeRooms = useMemo(
    () => rooms.filter(room => room.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rooms],
  );

  const loadRooms = async () => {
    setLoading(true);
    setError('');
    try {
      setRooms(await getAdminRoomTypes());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load room types.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRooms();
  }, []);

  const handleClearAll = async () => {
    const fromKey = hotelTodayKey();
    setClearing(true);
    try {
      await Promise.all(activeRooms.map(room => clearRoomRates(room.id, fromKey)));
      toast({
        title: 'Future price overrides cleared',
        description: `Reset ${activeRooms.length} room type(s) from ${format(dateFromKey(fromKey), 'MMM d, yyyy')} onward to base pricing.`,
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: 'Unable to clear price overrides',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title">Rates Center</h1>
          <p className="text-sm text-muted-foreground">Set exact room-only nightly rates for future dates.</p>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={loading || clearing || activeRooms.length === 0}>
              {clearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eraser className="h-4 w-4 mr-2" />}
              Clear future price overrides
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all future price overrides?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every per-date rate override from today onward across active rooms, reverting those dates to base and weekend pricing. Inventory and open/closed status are not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll} disabled={clearing}>
                {clearing ? 'Clearing...' : 'Clear overrides'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {loading && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
          Loading room types...
        </Card>
      )}

      {!loading && error && (
        <Card className="p-10 text-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={loadRooms}>Try again</Button>
        </Card>
      )}

      {!loading && !error && <BulkPriceUpdatePanel rooms={activeRooms} />}
    </div>
  );
}

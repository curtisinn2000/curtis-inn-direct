import { useState } from 'react';
import { BulkPriceUpdatePanel } from '@/components/admin/BulkPriceUpdatePanel';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useInventoryStore, dateKey } from '@/store/inventoryStore';
import { useToast } from '@/hooks/use-toast';
import { format, startOfToday } from 'date-fns';
import { Eraser } from 'lucide-react';

export default function AdminRatesPage() {
  const { toast } = useToast();
  const clearRateOverrides = useInventoryStore(s => s.clearRateOverrides);
  const roomTypes = useInventoryStore(s => s.roomTypes);
  const [open, setOpen] = useState(false);

  const handleClearAll = () => {
    const fromKey = dateKey(startOfToday());
    const ids = Object.values(roomTypes).filter(r => r.isActive).map(r => r.id);
    for (const id of ids) clearRateOverrides(id, fromKey);
    toast({
      title: 'Future price overrides cleared',
      description: `Reset ${ids.length} room type(s) from ${format(startOfToday(), 'MMM d, yyyy')} onward to base pricing.`,
    });
    setOpen(false);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title">Rates Center</h1>
          <p className="text-sm text-muted-foreground">You can make changes for dates up to 2 years from today.</p>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Eraser className="h-4 w-4 mr-2" /> Clear future price overrides
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all future price overrides?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove every per-date rate override (from today onward) across all active rooms, reverting them to base pricing. Inventory and open/closed status are NOT affected. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll}>Clear overrides</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <BulkPriceUpdatePanel />
    </div>
  );
}

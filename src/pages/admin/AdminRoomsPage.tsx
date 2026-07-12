import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { RoomTypeFormDialog, type RoomFormValues, type RoomTypeFormInitial } from '@/components/admin/RoomTypeFormDialog';
import roomFallback from '@/assets/room-king.jpg';
import type { RoomType } from '@/types';
import {
  createAdminRoomType,
  deleteAdminRoomType,
  getRoomTypes,
  getAdminRoomTypes,
  updateAdminRoomType,
  type RoomTypeWritePayload,
} from '@/services/api';

const roomToInitial = (room: RoomType): RoomTypeFormInitial => ({
  id: room.id,
  slug: room.slug,
  name: room.name,
  shortDescription: room.shortDescription,
  longDescription: room.longDescription,
  occupancy: room.occupancy,
  bedType: room.bedType,
  basePrice: room.basePrice,
  baseInventory: room.inventoryCount,
  isActive: room.isActive,
  images: room.images,
  sortOrder: room.sortOrder,
});

const valuesToPayload = (values: RoomFormValues, existing?: RoomType): RoomTypeWritePayload => ({
  name: values.name,
  slug: existing?.slug,
  shortDescription: values.shortDescription,
  longDescription: values.longDescription,
  occupancy: values.occupancy,
  bedType: values.bedType,
  basePrice: values.basePrice,
  baseInventory: values.baseInventory,
  isActive: values.isActive,
  images: values.images,
  amenities: existing?.amenities,
  policies: existing?.policies,
  cancellationTerms: existing?.cancellationTerms,
  sortOrder: existing?.sortOrder ?? 0,
});

export default function AdminRoomsPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit'; id?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [rooms],
  );
  const activeRooms = useMemo(() => sortedRooms.filter(room => room.isActive), [sortedRooms]);
  const hiddenRooms = useMemo(() => sortedRooms.filter(room => !room.isActive), [sortedRooms]);
  const editing = dialog?.mode === 'edit' ? rooms.find(r => r.id === dialog.id) : undefined;
  const deletingRoom = confirmDelete ? rooms.find(r => r.id === confirmDelete) : null;

  const loadRooms = async () => {
    setLoading(true);
    setError(null);
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

  const verifyHiddenFromPublic = async (room: RoomType) => {
    const publicRooms = await getRoomTypes();
    if (publicRooms.some(publicRoom => publicRoom.id === room.id || publicRoom.slug === room.slug)) {
      throw new Error(`${room.name} is still being returned by the public rooms API. Please try again before accepting bookings.`);
    }
  };

  const handleSubmit = async (vals: RoomFormValues) => {
    setSavingId(dialog?.id ?? 'new');
    try {
      if (dialog?.mode === 'add') {
        await createAdminRoomType(valuesToPayload(vals));
        toast({ title: 'Room type added', description: `${vals.name} is now saved in the backend.` });
      } else if (dialog?.mode === 'edit' && dialog.id) {
        const existing = rooms.find(room => room.id === dialog.id);
        await updateAdminRoomType(dialog.id, valuesToPayload(vals, existing));
        toast({ title: 'Room updated', description: `${vals.name} was saved.` });
      }
      setDialog(null);
      await loadRooms();
    } catch (err) {
      toast({
        title: 'Room save failed',
        description: err instanceof Error ? err.message : 'Unable to save room type.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleActiveChange = async (room: RoomType, active: boolean) => {
    setSavingId(room.id);
    try {
      await updateAdminRoomType(room.id, valuesToPayload({ ...roomToInitial(room), isActive: active }, room));
      if (!active) await verifyHiddenFromPublic(room);
      toast({
        title: active ? 'Room activated' : 'Room hidden',
        description: active ? `${room.name} is visible on the website.` : `${room.name} is hidden from public booking pages.`,
      });
      await loadRooms();
    } catch (err) {
      toast({
        title: 'Status update failed',
        description: err instanceof Error ? err.message : 'Unable to update room status.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const confirmDeleteRoom = async () => {
    if (!confirmDelete) return;
    const name = deletingRoom?.name ?? 'Room type';
    setSavingId(confirmDelete);
    try {
      await deleteAdminRoomType(confirmDelete);
      if (deletingRoom) await verifyHiddenFromPublic(deletingRoom);
      toast({ title: 'Room type deleted', description: `${name} was removed from the public website and booking flow. Historical reservations remain preserved.` });
      setConfirmDelete(null);
      await loadRooms();
    } catch (err) {
      toast({
        title: 'Remove failed',
        description: err instanceof Error ? err.message : 'Unable to remove room type.',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Room Types</h1>
          <p className="text-sm text-muted-foreground">
            {activeRooms.length} active on the website, {hiddenRooms.length} hidden from booking.
          </p>
        </div>
        <Button onClick={() => setDialog({ mode: 'add' })} disabled={loading || savingId !== null}><Plus className="h-4 w-4" /> Add room type</Button>
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

      {!loading && !error && (
        <div className="space-y-3">
          {activeRooms.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Active on website</h2>
              <Badge variant="secondary">{activeRooms.length}</Badge>
            </div>
          )}

          {activeRooms.map(room => {
            const cover = room.images[0] ?? roomFallback;
            const soldOut = room.inventoryCount === 0;
            const saving = savingId === room.id;
            return (
              <Card key={room.id} className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <img src={cover} alt={room.name} className="w-20 h-20 rounded-md object-cover bg-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{room.name}</h3>
                        <Badge variant={room.isActive ? 'default' : 'secondary'}>{room.isActive ? 'Active' : 'Inactive'}</Badge>
                        {soldOut && <Badge variant="destructive">Sold out</Badge>}
                        <span className="text-[10px] font-mono text-muted-foreground">ID: {room.id}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{room.shortDescription || '-'}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Occupancy: {room.occupancy}</span>
                        <span>Bed: {room.bedType}</span>
                        <span>Inventory: {room.inventoryCount}</span>
                        <span>Photos: {room.images.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold">${room.basePrice}</p>
                      <p className="text-xs text-muted-foreground">per night</p>
                    </div>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <RoomVisibilitySwitch
                      checked={room.isActive}
                      disabled={savingId !== null}
                      onCheckedChange={(checked) => void handleActiveChange(room, checked)}
                    />
                    <Button variant="outline" size="sm" disabled={savingId !== null} onClick={() => setDialog({ mode: 'edit', id: room.id })}>Edit</Button>
                    <Button variant="outline" size="sm" disabled={savingId !== null} onClick={() => setConfirmDelete(room.id)} aria-label="Delete room type">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      Delete room type
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {hiddenRooms.length > 0 && (
            <div className="flex items-center justify-between pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hidden from website and booking</h2>
              <Badge variant="secondary">{hiddenRooms.length}</Badge>
            </div>
          )}

          {hiddenRooms.map(room => {
            const cover = room.images[0] ?? roomFallback;
            const saving = savingId === room.id;
            return (
              <Card key={room.id} className="p-5 bg-muted/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <img src={cover} alt={room.name} className="w-20 h-20 rounded-md object-cover bg-muted shrink-0 opacity-70" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{room.name}</h3>
                        <Badge variant="secondary">Hidden</Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">ID: {room.id}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{room.shortDescription || '-'}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Occupancy: {room.occupancy}</span>
                        <span>Bed: {room.bedType}</span>
                        <span>Inventory: {room.inventoryCount}</span>
                        <span>Photos: {room.images.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    <RoomVisibilitySwitch
                      checked={room.isActive}
                      disabled={savingId !== null}
                      onCheckedChange={(checked) => void handleActiveChange(room, checked)}
                    />
                    <Button variant="outline" size="sm" disabled={savingId !== null} onClick={() => setDialog({ mode: 'edit', id: room.id })}>Edit</Button>
                    <Button variant="outline" size="sm" disabled={savingId !== null} onClick={() => setConfirmDelete(room.id)} aria-label="Delete room type">
                      <Trash2 className="h-4 w-4 text-destructive" />
                      Delete room type
                    </Button>
                    <Button size="sm" disabled={savingId !== null} onClick={() => void handleActiveChange(room, true)}>Reactivate</Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {sortedRooms.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No room types yet. Click <span className="font-medium">Add room type</span> to create one.
            </Card>
          )}
        </div>
      )}

      <RoomTypeFormDialog
        open={!!dialog}
        mode={dialog?.mode ?? 'add'}
        initial={editing ? roomToInitial(editing) : undefined}
        onClose={() => setDialog(null)}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingRoom?.name} room type?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the room type from public room listings, room detail pages, and new bookings. Historical reservations remain preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoom} disabled={savingId !== null} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete room type</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoomVisibilitySwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={checked ? 'Room type is active on the website' : 'Room type is hidden from the website'}
        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-red-500"
      />
      <span className={checked ? 'text-[10px] font-medium text-emerald-700' : 'text-[10px] font-medium text-red-700'}>
        {checked ? 'Active' : 'Hidden'}
      </span>
    </div>
  );
}

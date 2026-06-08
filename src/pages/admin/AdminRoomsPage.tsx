import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useInventoryStore, listRoomTypes, hasFutureReservations } from '@/store/inventoryStore';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2 } from 'lucide-react';
import { RoomTypeFormDialog, type RoomFormValues } from '@/components/admin/RoomTypeFormDialog';
import roomFallback from '@/assets/room-king.jpg';

export default function AdminRoomsPage() {
  const { toast } = useToast();
  const roomTypesMap = useInventoryStore(s => s.roomTypes);
  const rooms = useMemo(() => listRoomTypes({ roomTypes: roomTypesMap } as any), [roomTypesMap]);
  const upsertRoomType = useInventoryStore(s => s.upsertRoomType);
  const addRoomType = useInventoryStore(s => s.addRoomType);
  const deleteRoomType = useInventoryStore(s => s.deleteRoomType);
  const setRoomActive = useInventoryStore(s => s.setRoomActive);


  const [dialog, setDialog] = useState<{ mode: 'add' | 'edit'; id?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const editing = dialog?.mode === 'edit' ? rooms.find(r => r.id === dialog.id) : undefined;
  const deletingRoom = confirmDelete ? rooms.find(r => r.id === confirmDelete) : null;

  const handleSubmit = (vals: RoomFormValues) => {
    if (dialog?.mode === 'add') {
      addRoomType(vals);
      toast({ title: 'Room type added', description: `${vals.name} is now live on the booking site.` });
    } else if (dialog?.mode === 'edit' && dialog.id) {
      upsertRoomType({ id: dialog.id, ...vals });
      toast({ title: 'Room updated', description: `${vals.name} saved. Booking site reflects the change instantly.` });
    }
    setDialog(null);
  };

  const confirmDeleteRoom = () => {
    if (!confirmDelete) return;
    const state = useInventoryStore.getState();
    if (hasFutureReservations(state, confirmDelete)) {
      toast({ title: 'Cannot delete', description: 'This room type has upcoming reservations. Move or cancel them first.', variant: 'destructive' });
      setConfirmDelete(null);
      return;
    }
    const name = deletingRoom?.name ?? 'Room type';
    deleteRoomType(confirmDelete);
    toast({ title: 'Room type removed', description: `${name} was removed from the booking site.` });
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Room Types</h1>
          <p className="text-sm text-muted-foreground">{rooms.length} room types configured · Add, edit, or remove — changes go live instantly.</p>
        </div>
        <Button onClick={() => setDialog({ mode: 'add' })}><Plus className="h-4 w-4" /> Add room type</Button>
      </div>

      <div className="space-y-3">
        {rooms.map(room => {
          const cover = room.images[0] ?? roomFallback;
          const soldOut = room.baseInventory === 0;
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
                    <p className="text-sm text-muted-foreground line-clamp-1">{room.shortDescription || '—'}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>Occupancy: {room.occupancy}</span>
                      <span>Bed: {room.bedType}</span>
                      <span>Inventory: {room.baseInventory}</span>
                      <span>Photos: {room.images.length}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold">${room.basePrice}</p>
                    <p className="text-xs text-muted-foreground">per night</p>
                  </div>
                  <Switch checked={room.isActive} onCheckedChange={(c) => setRoomActive(room.id, c)} />
                  <Button variant="outline" size="sm" onClick={() => setDialog({ mode: 'edit', id: room.id })}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(room.id)} aria-label="Delete room type">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
        {rooms.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No room types yet. Click <span className="font-medium">Add room type</span> to create one.
          </Card>
        )}
      </div>

      <RoomTypeFormDialog
        open={!!dialog}
        mode={dialog?.mode ?? 'add'}
        initial={editing}
        onClose={() => setDialog(null)}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingRoom?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the room type from the booking site and clears its rate/availability overrides. Blocked if there are upcoming reservations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRoom} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

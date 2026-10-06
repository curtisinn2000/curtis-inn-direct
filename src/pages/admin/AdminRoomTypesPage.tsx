import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Loader2, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { deleteAdminRoomType, getAdminRoomTypes } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { useAdminSession, hasAdminPermission } from '@/contexts/AdminSessionContext';
import { ADMIN_PERMISSIONS } from '@/config/adminPermissions';
import type { RoomType } from '@/types';
import roomFallback from '@/assets/room-king.jpg';

export default function AdminRoomTypesPage() {
  const { user } = useAdminSession();
  const canManage = hasAdminPermission(user, ADMIN_PERMISSIONS.roomsManage);
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(() => [...rooms].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [rooms]);
  const load = async () => { setLoading(true); setError(''); try { setRooms(await getAdminRoomTypes()); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load room types.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const archive = async () => { if (!archiveId) return; setSaving(true); try { await deleteAdminRoomType(archiveId); toast({ title: 'Room type archived', description: 'It is no longer available for editing or new bookings. Historical reservations remain intact.' }); setArchiveId(null); await load(); } catch (err) { toast({ title: 'Archive failed', description: err instanceof Error ? err.message : 'Unable to archive room type.', variant: 'destructive' }); } finally { setSaving(false); } };

  return <div>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-title">Room Types</h1><p className="text-sm text-muted-foreground">Define accommodations, occupancy, amenities, policies, and photos. Rates and daily availability are managed in their dedicated centers.</p></div>{canManage && <Button asChild><Link to="/admin/room-types/new"><Plus className="h-4 w-4" /> Add room type</Link></Button>}</div>
    {loading && <Card className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading room types...</Card>}
    {!loading && error && <Card className="p-10 text-center"><p className="mb-4 text-destructive">{error}</p><Button variant="outline" onClick={() => void load()}>Try again</Button></Card>}
    {!loading && !error && <div className="space-y-3">{sorted.map(room => <Card key={room.id} className="p-4"><div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center"><img src={room.images[0] || roomFallback} alt="" className="aspect-[4/3] w-full rounded-md bg-muted object-cover" /><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h2 className="font-semibold">{room.name}</h2><Badge variant={room.isActive ? 'default' : 'secondary'}>{room.isActive ? 'Active' : 'Draft'}</Badge><Badge variant="outline">{room.category}</Badge></div><p className="line-clamp-1 text-sm text-muted-foreground">{room.shortDescription || 'No description yet'}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span>{room.bedSummary}</span><span>{room.maxGuests} guests ({room.maxAdults} adults, {room.maxChildren} children)</span><span>{room.inventoryCount} physical rooms</span><span>{room.images.length} photos</span></div></div>{canManage && <div className="flex gap-2"><Button variant="outline" asChild><Link to={`/admin/room-types/${room.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link></Button><Button variant="outline" onClick={() => setArchiveId(room.id)}><Archive className="h-4 w-4 text-destructive" /> Archive</Button></div>}</div></Card>)}{sorted.length === 0 && <Card className="p-10 text-center text-sm text-muted-foreground">No room types have been created.</Card>}</div>}
    <AlertDialog open={Boolean(archiveId)} onOpenChange={open => !open && setArchiveId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive this room type?</AlertDialogTitle><AlertDialogDescription>It will be removed from room management and future bookings. Historical and current reservation records remain preserved.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={() => void archive()} className="bg-destructive text-destructive-foreground">Archive room type</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

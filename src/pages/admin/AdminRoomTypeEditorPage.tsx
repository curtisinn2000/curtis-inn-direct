import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RoomTypeWizard } from '@/components/admin/RoomTypeWizard';
import { emptyRoomTypeForm, roomToForm, type RoomTypeFormValues } from '@/components/admin/roomTypeFormSchema';
import { createAdminRoomType, getAdminRoomTypes, getRoomTypeOptions, updateAdminRoomType, type RoomTypeWritePayload } from '@/services/api';
import type { RoomOptionsCatalog, RoomType } from '@/types';
import { useToast } from '@/hooks/use-toast';

const payload = (value: RoomTypeFormValues): RoomTypeWritePayload => ({
  category: value.category, standardName: value.standardName, customName: value.customName.trim() || null,
  shortDescription: value.shortDescription, longDescription: value.longDescription, maxGuests: value.maxGuests,
  maxAdults: value.maxAdults, maxChildren: value.maxChildren, bedrooms: value.bedrooms, baseInventory: value.baseInventory,
  isActive: value.isActive, extraBedsAllowed: value.extraBedsAllowed, maxExtraBeds: value.extraBedsAllowed ? value.maxExtraBeds : 0,
  extraBedTypes: value.extraBedsAllowed ? value.extraBedTypes : [], roomSizeSqFt: value.roomSizeSqFt,
  smokingDesignation: value.smokingDesignation, bathroomType: value.bathroomType, bathroomFeatures: value.bathroomFeatures,
  viewTypes: value.viewTypes, images: value.images, amenities: value.amenities, policies: value.policies,
  cancellationTerms: value.cancellationTerms.trim() || null, sortOrder: value.sortOrder,
});

export default function AdminRoomTypeEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [value, setValue] = useState<RoomTypeFormValues>(emptyRoomTypeForm());
  const [room, setRoom] = useState<RoomType | null>(null);
  const [options, setOptions] = useState<RoomOptionsCatalog>({ amenities: [], policies: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { let cancelled = false; Promise.all([getAdminRoomTypes(), getRoomTypeOptions()]).then(([rooms, catalog]) => { if (cancelled) return; const selected = id ? rooms.find(item => item.id === id) : undefined; if (id && !selected) throw new Error('Room type was not found.'); setRoom(selected ?? null); setValue(selected ? roomToForm(selected) : emptyRoomTypeForm()); setOptions(catalog); }).catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Unable to load room editor.')).finally(() => !cancelled && setLoading(false)); return () => { cancelled = true; }; }, [id]);
  const save = async (next: RoomTypeFormValues) => { setSaving(true); try { if (room) await updateAdminRoomType(room.id, payload(next)); else await createAdminRoomType(payload(next)); toast({ title: next.isActive ? 'Room type published' : 'Draft saved', description: `${next.customName || next.standardName} was saved.` }); navigate('/admin/room-types'); } catch (err) { toast({ title: 'Unable to save room type', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' }); } finally { setSaving(false); } };
  if (loading) return <Card className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading room editor...</Card>;
  if (error) return <Card className="p-10 text-center"><p className="mb-4 text-destructive">{error}</p><Button onClick={() => navigate('/admin/room-types')}>Back to Room Types</Button></Card>;
  return <div><Button variant="ghost" className="mb-4" onClick={() => navigate('/admin/room-types')}><ArrowLeft className="h-4 w-4" /> Room Types</Button><div className="mb-6"><h1 className="text-title">{room ? `Edit ${room.name}` : 'Add room type'}</h1><p className="text-sm text-muted-foreground">Build the room definition here. Use Rates Center and Availability Center for daily operations.</p></div><RoomTypeWizard value={value} basePrice={room?.basePrice ?? 0} options={options} saving={saving} onChange={setValue} onCancel={() => navigate('/admin/room-types')} onSubmit={save} /></div>;
}

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from 'lucide-react';
import { uploadContentImage } from '@/services/api';

export interface RoomFormValues {
  name: string;
  shortDescription: string;
  longDescription: string;
  occupancy: number;
  bedType: string;
  basePrice: number;
  baseInventory: number;
  isActive: boolean;
  images: string[];
}

export type RoomTypeFormInitial = RoomFormValues & {
  id?: string;
  slug?: string;
  sortOrder?: number;
};

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: RoomTypeFormInitial;
  onClose: () => void;
  onSubmit: (values: RoomFormValues) => void;
}

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1800;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export function RoomTypeFormDialog({ open, mode, initial, onClose, onSubmit }: Props) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [v, setV] = useState<RoomFormValues>({
    name: '', shortDescription: '', longDescription: '',
    occupancy: 2, bedType: 'Queen', basePrice: 0, baseInventory: 0, isActive: true, images: [],
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setV({
        name: initial.name,
        shortDescription: initial.shortDescription,
        longDescription: initial.longDescription,
        occupancy: initial.occupancy,
        bedType: initial.bedType,
        basePrice: initial.basePrice,
        baseInventory: initial.baseInventory,
        isActive: initial.isActive,
        images: initial.images,
      });
    } else {
      setV({ name: '', shortDescription: '', longDescription: '', occupancy: 2, bedType: 'Queen', basePrice: 0, baseInventory: 0, isActive: true, images: [] });
    }
  }, [open, initial]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_IMAGES - v.images.length;
    if (room <= 0) {
      toast({ title: 'Photo limit reached', description: `Max ${MAX_IMAGES} photos per room.`, variant: 'destructive' });
      return;
    }
    const pick = Array.from(files).slice(0, room);
    const collected: string[] = [];
    setUploading(true);
    try {
      for (const file of pick) {
        if (!ACCEPT.includes(file.type)) {
          toast({ title: 'Unsupported file', description: `${file.name} is not JPG/PNG/WebP.`, variant: 'destructive' });
          continue;
        }
        if (file.size > MAX_SOURCE_BYTES) {
          toast({ title: 'File too large', description: `${file.name} is too large to process. Please choose an image under 25 MB.`, variant: 'destructive' });
          continue;
        }

        let uploadFile: File;
        try {
          uploadFile = await prepareRoomImage(file);
        } catch (error) {
          toast({
            title: 'Image could not be processed',
            description: error instanceof Error ? `${file.name}: ${error.message}` : `${file.name} could not be processed.`,
            variant: 'destructive',
          });
          continue;
        }

        if (uploadFile.size > MAX_BYTES) {
          toast({ title: 'File too large', description: `${file.name} could not be optimized under 5 MB. Please choose a smaller image.`, variant: 'destructive' });
          continue;
        }

        try {
          const uploaded = await uploadContentImage(uploadFile);
          collected.push(uploaded.url);
        } catch (error) {
          toast({
            title: 'Upload failed',
            description: error instanceof Error ? `${file.name}: ${error.message}` : `${file.name} could not be uploaded.`,
            variant: 'destructive',
          });
        }
      }

      if (collected.length) {
        setV(s => ({ ...s, images: [...s.images, ...collected].slice(0, MAX_IMAGES) }));
        toast({
          title: collected.length === 1 ? 'Photo uploaded' : 'Photos uploaded',
          description: `${collected.length} room photo${collected.length === 1 ? '' : 's'} ready to save.`,
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= v.images.length) return;
    const next = [...v.images];
    [next[i], next[j]] = [next[j], next[i]];
    setV(s => ({ ...s, images: next }));
  };
  const setCover = (i: number) => {
    if (i === 0) return;
    const next = [...v.images];
    const [img] = next.splice(i, 1);
    next.unshift(img);
    setV(s => ({ ...s, images: next }));
  };
  const remove = (i: number) => setV(s => ({ ...s, images: s.images.filter((_, k) => k !== i) }));

  const canSave = v.name.trim().length > 0 && v.basePrice >= 0 && v.baseInventory >= 0 && !uploading;

  const save = () => {
    if (!canSave) {
      toast({ title: uploading ? 'Upload in progress' : 'Missing fields', description: uploading ? 'Please wait for room photos to finish uploading.' : 'Name is required.', variant: 'destructive' });
      return;
    }
    onSubmit({ ...v, name: v.name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add room type' : `Edit ${initial?.name ?? 'room'}`}</DialogTitle>
          <DialogDescription>
            Changes appear instantly on the booking site. Inventory 0 shows as Sold out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={v.name} onChange={e => setV(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Deluxe King Suite" />
          </div>

          <div>
            <Label className="text-xs">Short description</Label>
            <Input value={v.shortDescription} onChange={e => setV(s => ({ ...s, shortDescription: e.target.value }))} placeholder="One-line teaser used in listings" />
          </div>

          <div>
            <Label className="text-xs">Long description</Label>
            <Textarea rows={3} value={v.longDescription} onChange={e => setV(s => ({ ...s, longDescription: e.target.value }))} placeholder="Full description for the room detail page" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Occupancy</Label>
              <Input type="number" min={1} value={v.occupancy} onChange={e => setV(s => ({ ...s, occupancy: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div>
              <Label className="text-xs">Bed type</Label>
              <Input value={v.bedType} onChange={e => setV(s => ({ ...s, bedType: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Base price (per night)</Label>
              <Input type="number" min={0} value={v.basePrice} onChange={e => setV(s => ({ ...s, basePrice: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
            </div>
            <div>
              <Label className="text-xs">Inventory (total rooms)</Label>
              <Input type="number" min={0} value={v.baseInventory} onChange={e => setV(s => ({ ...s, baseInventory: Math.max(0, Math.round(Number(e.target.value) || 0)) }))} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Active on booking site</div>
              <div className="text-xs text-muted-foreground">Inactive rooms are hidden from public listings.</div>
            </div>
            <Switch checked={v.isActive} onCheckedChange={(c) => setV(s => ({ ...s, isActive: c }))} />
          </div>

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Photos ({v.images.length}/{MAX_IMAGES})</Label>
              <label className={`inline-flex items-center gap-1 text-xs text-primary ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
                <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Upload'}
                <input type="file" accept={ACCEPT.join(',')} multiple disabled={uploading} className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
            {v.images.length === 0 ? (
              <div className="border border-dashed rounded-md p-6 text-center text-xs text-muted-foreground">
                No photos yet. The first image becomes the cover used in listings.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {v.images.map((src, i) => (
                  <div key={i} className="relative group rounded-md overflow-hidden border">
                    <img src={src} alt={`Room ${i + 1}`} className="w-full h-24 object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 text-[10px] bg-foreground text-background px-1.5 py-0.5 rounded">Cover</span>
                    )}
                    <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                      <button type="button" onClick={() => move(i, -1)} className="p-1 bg-background rounded" aria-label="Move left"><ArrowLeft className="h-3 w-3" /></button>
                      {i !== 0 && (
                        <button type="button" onClick={() => setCover(i)} className="p-1 bg-background rounded" aria-label="Set as cover"><Star className="h-3 w-3" /></button>
                      )}
                      <button type="button" onClick={() => move(i, 1)} className="p-1 bg-background rounded" aria-label="Move right"><ArrowRight className="h-3 w-3" /></button>
                      <button type="button" onClick={() => remove(i)} className="p-1 bg-destructive text-destructive-foreground rounded" aria-label="Remove"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">JPG/PNG/WebP, optimized for web, max 5 MB each after optimization. Hover a photo to reorder, set as cover, or remove.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={save} disabled={!canSave}>{uploading ? 'Uploading photos...' : mode === 'add' ? 'Add room type' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function prepareRoomImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES && file.type === 'image/webp') return file;

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.86, 0.76, 0.66]) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality);
      if (blob.size <= MAX_BYTES) return new File([blob], replaceExtension(file.name, 'webp'), { type: 'image/webp' });
    }

    const fallbackBlob = await canvasToBlob(canvas, 'image/webp', 0.58);
    return new File([fallbackBlob], replaceExtension(file.name, 'webp'), { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Image could not be processed.'));
    }, type, quality);
  });
}

function replaceExtension(name: string, ext: string) {
  return name.replace(/\.[^.]+$/, '') + `.${ext}`;
}

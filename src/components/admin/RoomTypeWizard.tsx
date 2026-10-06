import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { uploadRoomImage } from '@/services/api';
import type { RoomOptionsCatalog, RoomType } from '@/types';
import { BATHROOM_FEATURES, BED_TYPES, STANDARD_NAMES, VIEW_TYPES, roomFormErrors, type RoomTypeFormValues } from './roomTypeFormSchema';

const STEPS = ['Basics', 'Beds', 'Occupancy', 'Extra Beds', 'Room Details', 'Amenities', 'Policies', 'Photos', 'Review & Publish'];
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES = 20;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export function RoomTypeWizard({ value, basePrice, options, saving, onChange, onCancel, onSubmit }: {
  value: RoomTypeFormValues;
  basePrice: number;
  options: RoomOptionsCatalog;
  saving: boolean;
  onChange: (value: RoomTypeFormValues) => void;
  onCancel: () => void;
  onSubmit: (value: RoomTypeFormValues) => Promise<void>;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [amenitySearch, setAmenitySearch] = useState('');
  const publishErrors = useMemo(() => roomFormErrors(value, basePrice), [value, basePrice]);
  const set = <K extends keyof RoomTypeFormValues>(key: K, next: RoomTypeFormValues[K]) => onChange({ ...value, [key]: next });
  const toggle = (key: 'amenities' | 'policies' | 'bathroomFeatures' | 'viewTypes' | 'extraBedTypes', item: string) => {
    const values = value[key] as string[];
    set(key, (values.includes(item) ? values.filter(entry => entry !== item) : [...values, item]) as RoomTypeFormValues[typeof key]);
  };

  const addBedroom = () => set('bedrooms', [...value.bedrooms, { name: `Bedroom ${value.bedrooms.length + 1}`, beds: [{ type: 'queen', quantity: 1 }] }]);
  const updateBedroom = (index: number, next: RoomTypeFormValues['bedrooms'][number]) => set('bedrooms', value.bedrooms.map((room, i) => i === index ? next : room));

  const uploadFiles = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, MAX_IMAGES - value.images.length);
    setUploading(true);
    const urls: string[] = [];
    try {
      for (const file of selected) {
        if (!ACCEPT.includes(file.type) || file.size > MAX_SOURCE_BYTES) {
          toast({ title: 'Photo rejected', description: `${file.name} must be JPG, PNG, or WebP and no larger than 25 MB before optimization.`, variant: 'destructive' });
          continue;
        }
        try {
          const prepared = await prepareRoomImage(file);
          if (prepared.size > MAX_BYTES) throw new Error('Could not optimize this photo below 5 MB.');
          urls.push((await uploadRoomImage(prepared)).url);
        } catch (error) {
          toast({ title: 'Upload failed', description: `${file.name}: ${error instanceof Error ? error.message : 'Unable to upload.'}`, variant: 'destructive' });
        }
      }
      if (urls.length) set('images', [...value.images, ...urls]);
    } finally { setUploading(false); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="space-y-1 xl:sticky xl:top-6 xl:self-start" aria-label="Room type setup steps">
        {STEPS.map((label, index) => (
          <button key={label} type="button" onClick={() => setStep(index)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${step === index ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px]">{index < step ? <Check className="h-3 w-3" /> : index + 1}</span>{label}
          </button>
        ))}
      </nav>

      <Card className="p-5 sm:p-7">
        <div className="mb-6"><p className="text-xs font-semibold uppercase text-muted-foreground">Step {step + 1} of {STEPS.length}</p><h2 className="text-xl font-semibold">{STEPS[step]}</h2></div>

        {step === 0 && <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2"><Field label="Accommodation category"><Select value={value.category} onValueChange={category => { const next = category as RoomTypeFormValues['category']; onChange({ ...value, category: next, standardName: STANDARD_NAMES[next][0] }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(STANDARD_NAMES).map(item => <SelectItem key={item} value={item}>{title(item)}</SelectItem>)}</SelectContent></Select></Field><Field label="Standard room type"><Select value={value.standardName} onValueChange={next => set('standardName', next)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STANDARD_NAMES[value.category].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field></div>
          <Field label="Custom public name" hint="Optional. When blank, the standard room type is displayed."><Input value={value.customName} onChange={event => set('customName', event.target.value)} /></Field>
          <Field label="Short description"><Input value={value.shortDescription} maxLength={500} onChange={event => set('shortDescription', event.target.value)} /></Field>
          <Field label="Full description"><Textarea rows={5} value={value.longDescription} maxLength={3000} onChange={event => set('longDescription', event.target.value)} /></Field>
          <Field label="Number of physical rooms" hint="Daily inventory can be adjusted in Availability Center, but cannot exceed this number."><Input type="number" min={0} max={999} value={value.baseInventory} onChange={event => set('baseInventory', Math.max(0, Number(event.target.value) || 0))} /></Field>
        </div>}

        {step === 1 && <div className="space-y-4">{value.bedrooms.map((bedroom, bedroomIndex) => <Card key={bedroomIndex} className="p-4 space-y-3"><div className="flex gap-3"><Input value={bedroom.name} onChange={event => updateBedroom(bedroomIndex, { ...bedroom, name: event.target.value })} /><Button variant="ghost" size="icon" disabled={value.bedrooms.length === 1} onClick={() => set('bedrooms', value.bedrooms.filter((_, i) => i !== bedroomIndex))}><Trash2 className="h-4 w-4" /></Button></div>{bedroom.beds.map((bed, bedIndex) => <div key={bedIndex} className="grid gap-3 sm:grid-cols-[1fr_100px_1fr_auto]"><Select value={bed.type} onValueChange={type => updateBedroom(bedroomIndex, { ...bedroom, beds: bedroom.beds.map((item, i) => i === bedIndex ? { ...item, type: type as typeof bed.type } : item) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BED_TYPES.map(type => <SelectItem key={type} value={type}>{title(type)} bed</SelectItem>)}</SelectContent></Select><Input type="number" min={1} max={10} value={bed.quantity} onChange={event => updateBedroom(bedroomIndex, { ...bedroom, beds: bedroom.beds.map((item, i) => i === bedIndex ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item) })} />{bed.type === 'other' ? <Input placeholder="Custom bed label" value={bed.customLabel ?? ''} onChange={event => updateBedroom(bedroomIndex, { ...bedroom, beds: bedroom.beds.map((item, i) => i === bedIndex ? { ...item, customLabel: event.target.value } : item) })} /> : <div />}<Button variant="ghost" size="icon" disabled={bedroom.beds.length === 1} onClick={() => updateBedroom(bedroomIndex, { ...bedroom, beds: bedroom.beds.filter((_, i) => i !== bedIndex) })}><Trash2 className="h-4 w-4" /></Button></div>)}<Button variant="outline" size="sm" onClick={() => updateBedroom(bedroomIndex, { ...bedroom, beds: [...bedroom.beds, { type: 'queen', quantity: 1 }] })}><Plus className="h-4 w-4" /> Add bed</Button></Card>)}<Button variant="outline" onClick={addBedroom}><Plus className="h-4 w-4" /> Add bedroom</Button></div>}

        {step === 2 && <div className="grid gap-5 md:grid-cols-3"><NumberField label="Maximum total guests" value={value.maxGuests} min={1} onChange={next => set('maxGuests', next)} /><NumberField label="Maximum adults" value={value.maxAdults} min={1} onChange={next => set('maxAdults', next)} /><NumberField label="Maximum children" value={value.maxChildren} min={0} onChange={next => set('maxChildren', next)} /></div>}

        {step === 3 && <div className="space-y-5"><div className="flex items-center justify-between rounded-md border p-4"><div><p className="font-medium">Allow extra beds</p><p className="text-sm text-muted-foreground">Extra-bed fees are not configured in this release.</p></div><Switch checked={value.extraBedsAllowed} onCheckedChange={checked => onChange({ ...value, extraBedsAllowed: checked, maxExtraBeds: checked ? Math.max(1, value.maxExtraBeds) : 0, extraBedTypes: checked ? value.extraBedTypes : [] })} /></div>{value.extraBedsAllowed && <><NumberField label="Maximum extra beds" value={value.maxExtraBeds} min={1} onChange={next => set('maxExtraBeds', next)} /><ChoiceGrid values={['Rollaway bed', 'Crib', 'Sofa bed']} selected={value.extraBedTypes} onToggle={item => toggle('extraBedTypes', item)} /></>}</div>}

        {step === 4 && <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><Field label="Room size (sq ft)"><Input type="number" min={1} value={value.roomSizeSqFt ?? ''} onChange={event => set('roomSizeSqFt', event.target.value ? Number(event.target.value) : null)} /></Field><Field label="Smoking"><Select value={value.smokingDesignation} onValueChange={next => set('smokingDesignation', next as RoomType['smokingDesignation'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="non_smoking">Non-smoking</SelectItem><SelectItem value="smoking">Smoking</SelectItem><SelectItem value="unspecified">Unspecified</SelectItem></SelectContent></Select></Field><Field label="Bathroom"><Select value={value.bathroomType} onValueChange={next => set('bathroomType', next as RoomType['bathroomType'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="shared">Shared</SelectItem><SelectItem value="unspecified">Unspecified</SelectItem></SelectContent></Select></Field></div><Field label="Bathroom features"><ChoiceGrid values={BATHROOM_FEATURES} selected={value.bathroomFeatures} onToggle={item => toggle('bathroomFeatures', item)} /></Field><Field label="Views"><ChoiceGrid values={VIEW_TYPES} selected={value.viewTypes} onToggle={item => toggle('viewTypes', item)} /></Field></div>}

        {step === 5 && <div className="space-y-4"><Input placeholder="Search amenities" value={amenitySearch} onChange={event => setAmenitySearch(event.target.value)} /><ChoiceGrid values={options.amenities.map(item => item.label).filter(item => item.toLowerCase().includes(amenitySearch.toLowerCase()))} selected={value.amenities} onToggle={item => toggle('amenities', item)} /></div>}

        {step === 6 && <div className="space-y-5"><p className="text-sm text-muted-foreground">Global hotel policies are inherited automatically. Select only additional room-specific policies.</p><ChoiceGrid values={options.policies.map(item => item.label)} selected={value.policies} onToggle={item => toggle('policies', item)} /><Field label="Cancellation override" hint="Leave blank to inherit the global cancellation rule from Settings."><Textarea rows={3} value={value.cancellationTerms} onChange={event => set('cancellationTerms', event.target.value)} /></Field></div>}

        {step === 7 && <div className="space-y-4"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">The first photo is the cover. JPG, PNG, or WebP; files are optimized before upload.</p><label><Button asChild variant="outline" disabled={uploading || value.images.length >= MAX_IMAGES}><span><Upload className="h-4 w-4" />{uploading ? 'Uploading...' : 'Upload photos'}</span></Button><input className="hidden" type="file" multiple accept={ACCEPT.join(',')} disabled={uploading} onChange={event => { void uploadFiles(event.target.files); event.target.value = ''; }} /></label></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{value.images.map((src, index) => <div key={src} className="relative overflow-hidden rounded-md border"><img src={src} alt={`Room photo ${index + 1}`} className="aspect-[4/3] w-full object-cover" />{index === 0 && <span className="absolute left-2 top-2 rounded bg-foreground px-2 py-1 text-xs text-background">Cover</span>}<div className="flex justify-center gap-1 p-2"><Button size="icon" variant="ghost" disabled={index === 0} onClick={() => moveImage(value, onChange, index, index - 1)}><ArrowLeft className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={index === 0} onClick={() => moveImage(value, onChange, index, 0)}><Star className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={index === value.images.length - 1} onClick={() => moveImage(value, onChange, index, index + 1)}><ArrowRight className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => set('images', value.images.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div></div>}

        {step === 8 && <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Summary label="Public name" value={value.customName || value.standardName} /><Summary label="Category" value={title(value.category)} /><Summary label="Beds" value={value.bedrooms.flatMap(room => room.beds.map(bed => `${bed.quantity} ${bed.type === 'other' ? bed.customLabel : title(bed.type)} bed${bed.quantity === 1 ? '' : 's'}`)).join(', ')} /><Summary label="Occupancy" value={`${value.maxGuests} total, ${value.maxAdults} adults, ${value.maxChildren} children`} /><Summary label="Physical inventory" value={String(value.baseInventory)} /><Summary label="Default rate" value={basePrice > 0 ? `$${basePrice}` : 'Not set'} /></div>{publishErrors.length > 0 && <div className="rounded-md border border-warning/50 bg-warning/10 p-4"><p className="font-medium">Before publishing</p><ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{publishErrors.map(error => <li key={error}>{error}</li>)}</ul></div>}<div className="flex items-center justify-between rounded-md border p-4"><div><p className="font-medium">Publish on booking site</p><p className="text-sm text-muted-foreground">Drafts remain available for editing but are hidden publicly.</p></div><Switch checked={value.isActive} disabled={publishErrors.length > 0} onCheckedChange={checked => set('isActive', checked)} /></div></div>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Button variant="ghost" onClick={step === 0 ? onCancel : () => setStep(current => current - 1)}><ArrowLeft className="h-4 w-4" />{step === 0 ? 'Cancel' : 'Back'}</Button>{step < STEPS.length - 1 ? <Button onClick={() => setStep(current => current + 1)}>Next <ArrowRight className="h-4 w-4" /></Button> : <div className="flex gap-2"><Button variant="outline" disabled={saving || uploading} onClick={() => onSubmit({ ...value, isActive: false })}>Save Draft</Button><Button disabled={saving || uploading || publishErrors.length > 0} onClick={() => onSubmit({ ...value, isActive: true })}>{saving ? 'Saving...' : 'Publish'}</Button></div>}</div>
      </Card>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <div><Label className="mb-1.5 block">{label}</Label>{children}{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>; }
function NumberField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" min={min} max={20} value={value} onChange={event => onChange(Math.max(min, Number(event.target.value) || min))} /></Field>; }
function ChoiceGrid({ values, selected, onToggle }: { values: readonly string[]; selected: string[]; onToggle: (value: string) => void }) { return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{values.map(item => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"><Checkbox checked={selected.includes(item)} onCheckedChange={() => onToggle(item)} /><span>{title(item)}</span></label>)}</div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || 'Not provided'}</p></div>; }
function title(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()); }
function moveImage(value: RoomTypeFormValues, onChange: (value: RoomTypeFormValues) => void, from: number, to: number) { const images = [...value.images]; const [image] = images.splice(from, 1); images.splice(to, 0, image); onChange({ ...value, images }); }

async function prepareRoomImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES && file.type === 'image/webp') return file;
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56]) { const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Image processing failed.')), 'image/webp', quality)); if (blob.size <= MAX_BYTES) return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }); }
    return file;
  } finally { bitmap.close(); }
}

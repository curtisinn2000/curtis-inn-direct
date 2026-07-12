import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { FAQ, GalleryImage, NearbyAttraction, PropertyContent, Review, WebsiteContent } from '@/types';
import {
  createAttraction,
  createFaq,
  createGalleryImage,
  createReview,
  deleteAttraction,
  deleteFaq,
  deleteGalleryImage,
  deleteReview,
  getAdminWebsiteContent,
  updateHeroContent,
  uploadContentImage,
} from '@/services/api';
import { resolveContentImage } from '@/lib/contentImages';
import { GripVertical, ImageIcon, Loader2, Plus, Star, Trash2, Upload } from 'lucide-react';

const emptyContent: WebsiteContent = {
  hero: {
    heroTitle: 'Curtis Inn & Suites',
    heroSubtitle: 'Your Hollywood, Florida Getaway',
    heroDescription: 'Affordable comfort steps from Hollywood Beach.',
  },
  faqs: [],
  gallery: [],
  reviews: [],
  attractions: [],
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxImageBytes = 5 * 1024 * 1024;

export default function AdminContentPage() {
  const { toast } = useToast();
  const [content, setContent] = useState<WebsiteContent>(emptyContent);
  const [hero, setHero] = useState<PropertyContent>(emptyContent.hero);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<'faq' | 'gallery' | 'review' | 'attraction' | null>(null);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryPreview, setGalleryPreview] = useState('');
  const [attractionFile, setAttractionFile] = useState<File | null>(null);
  const [attractionPreview, setAttractionPreview] = useState('');
  const [faqForm, setFaqForm] = useState<Omit<FAQ, 'id'>>({ question: '', answer: '', category: 'General', sortOrder: 0 });
  const [galleryForm, setGalleryForm] = useState<Omit<GalleryImage, 'id'>>({ url: '', alt: '', category: 'exterior', sortOrder: 0 });
  const [reviewForm, setReviewForm] = useState<Omit<Review, 'id'>>({
    guestName: '',
    rating: 5,
    comment: '',
    date: todayKey(),
    source: 'Direct',
    isFeatured: true,
    sortOrder: 0,
  });
  const [attractionForm, setAttractionForm] = useState<Omit<NearbyAttraction, 'id'>>({
    name: '',
    description: '',
    distance: '',
    image: '',
    category: 'Area',
    sortOrder: 0,
  });

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminWebsiteContent();
      setContent(data);
      setHero(data.hero);
    } catch (err) {
      toast({
        title: 'Unable to load content',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  async function saveHero() {
    setSaving(true);
    try {
      const saved = await updateHeroContent(hero);
      setContent(current => ({ ...current, hero: saved }));
      setHero(saved);
      toast({ title: 'Hero content saved', description: 'The homepage hero copy is now live.' });
    } catch (err) {
      toast({
        title: 'Hero content was not saved',
        description: err instanceof Error ? err.message : 'Please check the fields and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function submitFaq(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createFaq({ ...faqForm, sortOrder: nextSort(content.faqs) });
      setFaqForm({ question: '', answer: '', category: 'General', sortOrder: 0 });
      setDialog(null);
      await loadContent();
      toast({ title: 'FAQ added', description: 'The new FAQ is now visible on the website.' });
    } catch (err) {
      showError('FAQ was not added', err);
    } finally {
      setSaving(false);
    }
  }

  async function submitGallery(event: FormEvent) {
    event.preventDefault();
    if (!galleryFile) {
      showError('Gallery image was not added', new Error('Please choose an image to upload.'));
      return;
    }
    setSaving(true);
    try {
      const uploaded = await uploadContentImage(galleryFile);
      await createGalleryImage({ ...galleryForm, url: uploaded.url, sortOrder: nextSort(content.gallery) });
      setGalleryForm({ url: '', alt: '', category: 'exterior', sortOrder: 0 });
      clearGalleryFile();
      setDialog(null);
      await loadContent();
      toast({ title: 'Gallery image added', description: 'The image is now visible in the website gallery.' });
    } catch (err) {
      showError('Gallery image was not added', err);
    } finally {
      setSaving(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createReview({ ...reviewForm, sortOrder: nextSort(content.reviews) });
      setReviewForm({ guestName: '', rating: 5, comment: '', date: todayKey(), source: 'Direct', isFeatured: true, sortOrder: 0 });
      setDialog(null);
      await loadContent();
      toast({ title: 'Review added', description: 'The review is now visible on the website.' });
    } catch (err) {
      showError('Review was not added', err);
    } finally {
      setSaving(false);
    }
  }

  async function submitAttraction(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const uploaded = attractionFile ? await uploadContentImage(attractionFile) : null;
      await createAttraction({
        ...attractionForm,
        image: uploaded?.url ?? attractionForm.image,
        sortOrder: nextSort(content.attractions),
      });
      setAttractionForm({ name: '', description: '', distance: '', image: '', category: 'Area', sortOrder: 0 });
      clearAttractionFile();
      setDialog(null);
      await loadContent();
      toast({ title: 'Attraction added', description: 'The attraction is now visible on the website.' });
    } catch (err) {
      showError('Attraction was not added', err);
    } finally {
      setSaving(false);
    }
  }

  function validateImageFile(file: File) {
    if (!allowedImageTypes.includes(file.type)) {
      throw new Error('Only JPG, PNG, and WebP images can be uploaded.');
    }
    if (file.size > maxImageBytes) {
      throw new Error('Images must be 5 MB or smaller.');
    }
  }

  function chooseGalleryFile(file: File | undefined) {
    if (!file) return;
    try {
      validateImageFile(file);
      clearGalleryFile();
      setGalleryFile(file);
      setGalleryPreview(URL.createObjectURL(file));
    } catch (err) {
      showError('Image was not selected', err);
    }
  }

  function chooseAttractionFile(file: File | undefined) {
    if (!file) return;
    try {
      validateImageFile(file);
      clearAttractionFile();
      setAttractionFile(file);
      setAttractionPreview(URL.createObjectURL(file));
    } catch (err) {
      showError('Image was not selected', err);
    }
  }

  function clearGalleryFile() {
    if (galleryPreview.startsWith('blob:')) URL.revokeObjectURL(galleryPreview);
    setGalleryFile(null);
    setGalleryPreview('');
  }

  function clearAttractionFile() {
    if (attractionPreview.startsWith('blob:')) URL.revokeObjectURL(attractionPreview);
    setAttractionFile(null);
    setAttractionPreview('');
  }

  function showError(title: string, err: unknown) {
    toast({
      title,
      description: err instanceof Error ? err.message : 'Please check the fields and try again.',
      variant: 'destructive',
    });
  }

  async function removeItem(kind: 'faq' | 'gallery' | 'review' | 'attraction', id: string, label: string) {
    if (!window.confirm(`Delete "${label}" from the website?`)) return;
    setSaving(true);
    try {
      if (kind === 'faq') await deleteFaq(id);
      if (kind === 'gallery') await deleteGalleryImage(id);
      if (kind === 'review') await deleteReview(id);
      if (kind === 'attraction') await deleteAttraction(id);
      await loadContent();
      toast({ title: 'Content deleted', description: `${label} was removed from the website.` });
    } catch (err) {
      showError('Content was not deleted', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
        Loading website content...
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title">Content Management</h1>
        <p className="text-sm text-muted-foreground">Edit website content</p>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="mb-6">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="attractions">Attractions</TabsTrigger>
        </TabsList>

        <TabsContent value="hero">
          <Card className="p-6 space-y-4">
            <div>
              <Label htmlFor="hero-title">Hero Title</Label>
              <Input id="hero-title" value={hero.heroTitle} onChange={event => setHero({ ...hero, heroTitle: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-subtitle">Hero Subtitle</Label>
              <Input id="hero-subtitle" value={hero.heroSubtitle} onChange={event => setHero({ ...hero, heroSubtitle: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-description">Hero Description</Label>
              <Textarea id="hero-description" value={hero.heroDescription} onChange={event => setHero({ ...hero, heroDescription: event.target.value })} />
            </div>
            <Button onClick={saveHero} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <div className="space-y-3">
            {content.faqs.map(faq => (
              <Card key={faq.id} className="p-4 flex items-start gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{faq.question}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{faq.answer}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem('faq', faq.id, faq.question)} disabled={saving}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setDialog('faq')}>
              <Plus className="mr-1 h-4 w-4" /> Add FAQ
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="gallery">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {content.gallery.map(img => (
              <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                <img src={resolveContentImage(img.url)} alt={img.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center">
                  <Button variant="destructive" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem('gallery', img.id, img.alt)} disabled={saving}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDialog('gallery')}
              className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors"
            >
              <Plus className="h-8 w-8" />
            </button>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="space-y-3">
            {content.reviews.map(review => (
              <Card key={review.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {review.guestName}
                    <span className="inline-flex">{renderStars(review.rating)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{review.comment}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem('review', review.id, review.guestName)} disabled={saving}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setDialog('review')}>
              <Plus className="mr-1 h-4 w-4" /> Add Review
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="attractions">
          <div className="space-y-3">
            {content.attractions.map(attraction => (
              <Card key={attraction.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {attraction.image && (
                    <img src={resolveContentImage(attraction.image)} alt="" className="h-16 w-20 shrink-0 rounded-md object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{attraction.name}</p>
                    <p className="text-xs text-muted-foreground">{attraction.distance} - {attraction.description}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem('attraction', attraction.id, attraction.name)} disabled={saving}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setDialog('attraction')}>
              <Plus className="mr-1 h-4 w-4" /> Add Attraction
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialog === 'faq'} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add FAQ</DialogTitle>
            <DialogDescription>This question and answer will appear on the public FAQ page.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitFaq} className="space-y-4">
            <Field label="Question"><Input required value={faqForm.question} onChange={event => setFaqForm({ ...faqForm, question: event.target.value })} /></Field>
            <Field label="Answer"><Textarea required value={faqForm.answer} onChange={event => setFaqForm({ ...faqForm, answer: event.target.value })} /></Field>
            <Field label="Category"><Input required value={faqForm.category} onChange={event => setFaqForm({ ...faqForm, category: event.target.value })} /></Field>
            <DialogFooter><Button type="submit" disabled={saving}>Add FAQ</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'gallery'} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Gallery Image</DialogTitle>
            <DialogDescription>Upload a JPG, PNG, or WebP image up to 5 MB.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitGallery} className="space-y-4">
            <ImageUploadField
              label="Image"
              fileName={galleryFile?.name}
              previewUrl={galleryPreview}
              required
              onChange={chooseGalleryFile}
              onClear={clearGalleryFile}
            />
            <Field label="Alt Text"><Input required value={galleryForm.alt} onChange={event => setGalleryForm({ ...galleryForm, alt: event.target.value })} /></Field>
            <Field label="Category"><Input required value={galleryForm.category} onChange={event => setGalleryForm({ ...galleryForm, category: event.target.value as GalleryImage['category'] })} /></Field>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Image
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'review'} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Review</DialogTitle>
            <DialogDescription>This review will appear on the homepage reviews section.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReview} className="space-y-4">
            <Field label="Guest Name"><Input required value={reviewForm.guestName} onChange={event => setReviewForm({ ...reviewForm, guestName: event.target.value })} /></Field>
            <Field label="Rating"><Input required type="number" min={1} max={5} value={reviewForm.rating} onChange={event => setReviewForm({ ...reviewForm, rating: Number(event.target.value) })} /></Field>
            <Field label="Comment"><Textarea required value={reviewForm.comment} onChange={event => setReviewForm({ ...reviewForm, comment: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input required type="date" value={reviewForm.date} onChange={event => setReviewForm({ ...reviewForm, date: event.target.value })} /></Field>
              <Field label="Source"><Input required value={reviewForm.source} onChange={event => setReviewForm({ ...reviewForm, source: event.target.value })} /></Field>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>Add Review</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'attraction'} onOpenChange={open => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Attraction</DialogTitle>
            <DialogDescription>This attraction will appear on the homepage and Location page.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAttraction} className="space-y-4">
            <Field label="Name"><Input required value={attractionForm.name} onChange={event => setAttractionForm({ ...attractionForm, name: event.target.value })} /></Field>
            <Field label="Distance"><Input required value={attractionForm.distance} onChange={event => setAttractionForm({ ...attractionForm, distance: event.target.value })} /></Field>
            <Field label="Description"><Textarea required value={attractionForm.description} onChange={event => setAttractionForm({ ...attractionForm, description: event.target.value })} /></Field>
            <ImageUploadField
              label="Attraction image"
              fileName={attractionFile?.name}
              previewUrl={attractionPreview}
              onChange={chooseAttractionFile}
              onClear={clearAttractionFile}
            />
            <div className="grid grid-cols-1 gap-3">
              <Field label="Category"><Input required value={attractionForm.category} onChange={event => setAttractionForm({ ...attractionForm, category: event.target.value })} /></Field>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Attraction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ImageUploadField({
  label,
  fileName,
  previewUrl,
  required = false,
  onChange,
  onClear,
}: {
  label: string;
  fileName?: string;
  previewUrl: string;
  required?: boolean;
  onChange: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const inputId = `content-upload-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}{required ? ' *' : ''}</Label>
      <div className="flex flex-col gap-3">
        {previewUrl ? (
          <div className="relative overflow-hidden rounded-md border bg-muted">
            <img src={previewUrl} alt="" className="h-48 w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-36 items-center justify-center rounded-md border border-dashed bg-muted/40 text-muted-foreground">
            <ImageIcon className="mr-2 h-5 w-5" />
            <span className="text-sm">No image selected</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={event => onChange(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => document.getElementById(inputId)?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Choose Image
          </Button>
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          {previewUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function nextSort(items: Array<{ sortOrder?: number }>) {
  return items.reduce((max, item) => Math.max(max, Number(item.sortOrder ?? 0)), 0) + 1;
}

function renderStars(rating: number) {
  return Array.from({ length: Math.max(1, Math.min(5, rating)) }).map((_, index) => (
    <Star key={index} className="h-3.5 w-3.5 fill-accent text-accent" />
  ));
}

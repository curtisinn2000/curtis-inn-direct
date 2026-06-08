import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PROPERTY } from '@/config/constants';
import { MOCK_FAQS, MOCK_GALLERY, MOCK_REVIEWS, MOCK_ATTRACTIONS } from '@/data/mock-data';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export default function AdminContentPage() {
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
            <div><Label>Hero Title</Label><Input defaultValue={PROPERTY.name} /></div>
            <div><Label>Hero Subtitle</Label><Input defaultValue="Your Hollywood, Florida Getaway" /></div>
            <div><Label>Hero Description</Label><Textarea defaultValue="Affordable comfort steps from Hollywood Beach." /></div>
            <Button>Save Changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <div className="space-y-3">
            {MOCK_FAQS.map(faq => (
              <Card key={faq.id} className="p-4 flex items-start gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-1 cursor-grab" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{faq.question}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{faq.answer}</p>
                </div>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
            <Button variant="outline" className="w-full"><Plus className="mr-1 h-4 w-4" /> Add FAQ</Button>
          </div>
        </TabsContent>

        <TabsContent value="gallery">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MOCK_GALLERY.map(img => (
              <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center">
                  <Button variant="destructive" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <button className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center text-muted-foreground hover:border-accent hover:text-accent transition-colors">
              <Plus className="h-8 w-8" />
            </button>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="space-y-3">
            {MOCK_REVIEWS.map(r => (
              <Card key={r.id} className="p-4 flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{r.guestName} — {'★'.repeat(r.rating)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.comment}</p>
                </div>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
            <Button variant="outline" className="w-full"><Plus className="mr-1 h-4 w-4" /> Add Review</Button>
          </div>
        </TabsContent>

        <TabsContent value="attractions">
          <div className="space-y-3">
            {MOCK_ATTRACTIONS.map(a => (
              <Card key={a.id} className="p-4 flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.distance} — {a.description}</p>
                </div>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
            <Button variant="outline" className="w-full"><Plus className="mr-1 h-4 w-4" /> Add Attraction</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

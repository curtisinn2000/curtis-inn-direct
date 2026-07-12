import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fallbackContentImages, resolveContentImage } from '@/lib/contentImages';
import { GALLERY_CATEGORY_OPTIONS } from '@/lib/galleryCategories';
import { getWebsiteContent } from '@/services/api';
import type { GalleryImage } from '@/types';

const galleryFilters = [{ value: 'all', label: 'All' }, ...GALLERY_CATEGORY_OPTIONS] as const;

export default function GalleryPage() {
  const [filter, setFilter] = useState<string>('all');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filtered = filter === 'all'
    ? images
    : images.filter(image => image.category.toLowerCase() === filter);

  useEffect(() => {
    let cancelled = false;
    async function loadGallery() {
      setLoading(true);
      setError('');
      try {
        const content = await getWebsiteContent();
        if (!cancelled) setImages(content.gallery);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load gallery.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadGallery();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <p className="text-overline mb-2">Gallery</p>
          <h1 className="text-headline">Explore our property</h1>
        </div>

        {loading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
            Loading gallery...
          </Card>
        )}

        {!loading && error && <Card className="p-8 text-center text-sm text-destructive">{error}</Card>}

        {!loading && !error && (
          <>
            <div className="flex gap-2 mb-8 flex-wrap">
              {galleryFilters.map(category => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setFilter(category.value)}
                  className={cn('px-4 py-2 text-sm rounded-full transition-colors', filter === category.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                >
                  {category.label}
                </button>
              ))}
            </div>
            {images.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground">Gallery images will be added soon.</Card>
            )}
            {images.length > 0 && filtered.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No images have been added to this group yet.
              </Card>
            )}
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(image => (
                  <div key={image.id} className="aspect-[4/3] rounded-lg overflow-hidden group">
                    <img
                      src={resolveContentImage(image.url, fallbackContentImages.hero)}
                      alt={image.alt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

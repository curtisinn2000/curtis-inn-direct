import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fallbackContentImages, resolveContentImage } from '@/lib/contentImages';
import { getWebsiteContent } from '@/services/api';
import type { GalleryImage } from '@/types';

export default function GalleryPage() {
  const [filter, setFilter] = useState<string>('All');
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const categories = useMemo(() => ['All', ...new Set(images.map(image => titleCase(image.category)))], [images]);
  const filtered = filter === 'All' ? images : images.filter(image => titleCase(image.category) === filter);

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
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  className={cn('px-4 py-2 text-sm rounded-full transition-colors', filter === category ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                >
                  {category}
                </button>
              ))}
            </div>
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
            {images.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground">Gallery images will be added soon.</Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

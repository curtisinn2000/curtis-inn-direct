import { Card } from '@/components/ui/card';
import { PROPERTY } from '@/config/constants';
import { getWebsiteContent } from '@/services/api';
import type { NearbyAttraction } from '@/types';
import { Loader2, MapPin } from 'lucide-react';
import beachImg from '@/assets/beach.jpg';
import { useEffect, useState } from 'react';
import { fallbackContentImages, resolveContentImage } from '@/lib/contentImages';

export default function LocationPage() {
  const [attractions, setAttractions] = useState<NearbyAttraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showAttractionMedia = attractions.some(attraction => attraction.image);

  useEffect(() => {
    let cancelled = false;
    async function loadAttractions() {
      setLoading(true);
      setError('');
      try {
        const content = await getWebsiteContent();
        if (!cancelled) setAttractions(content.attractions);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load attractions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAttractions();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <p className="text-overline mb-2">Location</p>
          <h1 className="text-headline mb-4">Find Us</h1>
          <p className="text-body text-muted-foreground max-w-2xl">
            Ideally located on Federal Highway in Hollywood, Florida, minutes from the beach, shopping, and entertainment.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <Card className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <MapPin className="h-5 w-5 text-accent mt-0.5" />
              <div>
                <h3 className="font-semibold">{PROPERTY.name}</h3>
                <p className="text-muted-foreground text-sm">{PROPERTY.address}</p>
              </div>
            </div>
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Map embed placeholder. Replace with a Google Maps iframe.</p>
            </div>
          </Card>
          <div className="aspect-[4/3] lg:aspect-auto rounded-xl overflow-hidden">
            <img src={beachImg} alt="Hollywood Beach" className="w-full h-full object-cover" loading="lazy" />
          </div>
        </div>

        <div>
          <h2 className="text-title mb-6">Nearby Attractions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading && (
              <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
                Loading attractions...
              </Card>
            )}
            {!loading && error && <Card className="p-8 text-center text-sm text-destructive md:col-span-2">{error}</Card>}
            {!loading && !error && attractions.map(attraction => (
              <Card key={attraction.id} className="h-full overflow-hidden flex flex-col">
                {showAttractionMedia && (
                  <div className="aspect-[16/9] bg-muted">
                    {attraction.image ? (
                      <img src={resolveContentImage(attraction.image, fallbackContentImages.beach)} alt={attraction.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <MapPin className="h-7 w-7 text-accent/70" />
                      </div>
                    )}
                  </div>
                )}
                <div className="p-5 flex flex-1 items-start gap-4">
                  <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div className="flex min-h-[7rem] flex-col">
                    <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">{attraction.name}</h3>
                    <p className="text-xs text-accent font-medium mb-1">{attraction.distance}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">{attraction.description}</p>
                  </div>
                </div>
              </Card>
            ))}
            {!loading && !error && attractions.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2">
                Nearby attractions will be added soon.
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

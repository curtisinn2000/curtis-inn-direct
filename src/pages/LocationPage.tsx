import { Card } from '@/components/ui/card';
import { PROPERTY } from '@/config/constants';
import { MOCK_ATTRACTIONS } from '@/data/mock-data';
import { MapPin } from 'lucide-react';
import beachImg from '@/assets/beach.jpg';

export default function LocationPage() {
  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <p className="text-overline mb-2">Location</p>
          <h1 className="text-headline mb-4">Find Us</h1>
          <p className="text-body text-muted-foreground max-w-2xl">
            Ideally located on Federal Highway in Hollywood, Florida — minutes from the beach, shopping, and entertainment.
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
              <p className="text-muted-foreground text-sm">Map embed placeholder — replace with Google Maps iframe</p>
            </div>
          </Card>
          <div className="aspect-[4/3] lg:aspect-auto rounded-xl overflow-hidden">
            <img src={beachImg} alt="Hollywood Beach" className="w-full h-full object-cover" loading="lazy" />
          </div>
        </div>

        <div>
          <h2 className="text-title mb-6">Nearby Attractions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_ATTRACTIONS.map(a => (
              <Card key={a.id} className="p-5 flex items-start gap-4">
                <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm">{a.name}</h3>
                  <p className="text-xs text-accent font-medium mb-1">{a.distance}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

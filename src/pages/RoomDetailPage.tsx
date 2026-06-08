import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MOCK_ROOMS } from '@/data/mock-rooms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BedDouble, Check, ArrowLeft } from 'lucide-react';
import roomImg from '@/assets/room-king.jpg';
import { useInventoryStore, getRemaining, getRoomBySlug } from '@/store/inventoryStore';
import { startOfToday } from 'date-fns';

const DEFAULT_AMENITIES = ['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Private Bathroom'];
const DEFAULT_POLICIES = ['Non-smoking', 'No pets'];
const DEFAULT_CANCELLATION = 'Free cancellation up to 48 hours before check-in.';

export default function RoomDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const state = useInventoryStore();
  const live = slug ? getRoomBySlug(state, slug) : undefined;
  const fallback = MOCK_ROOMS.find(r => r.slug === slug);

  const room = live ?? (fallback ? {
    id: fallback.id, slug: fallback.slug, name: fallback.name,
    shortDescription: fallback.shortDescription, longDescription: fallback.longDescription,
    occupancy: fallback.occupancy, bedType: fallback.bedType,
    baseInventory: fallback.inventoryCount, basePrice: fallback.basePrice,
    isActive: fallback.isActive, images: [], sortOrder: fallback.sortOrder,
  } : null);

  const taxRate = fallback?.taxRate ?? 0.13;
  const amenities = fallback?.amenities ?? DEFAULT_AMENITIES;
  const policies = fallback?.policies ?? DEFAULT_POLICIES;
  const cancellationTerms = fallback?.cancellationTerms ?? DEFAULT_CANCELLATION;

  const [activeImg, setActiveImg] = useState(0);

  if (!room) {
    return (
      <div className="section-padding container-narrow text-center">
        <h1 className="text-headline mb-4">Room not found</h1>
        <Button asChild><Link to="/rooms">Back to rooms</Link></Button>
      </div>
    );
  }

  const remaining = getRemaining(state, room.id, startOfToday());
  const soldOut = remaining === 0;
  const images = room.images.length ? room.images : [roomImg];

  return (
    <div className="section-padding">
      <div className="container-wide">
        <Link to="/rooms" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> All rooms
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Image gallery */}
          <div>
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted">
              <img src={images[activeImg]} alt={room.name} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`aspect-square rounded-md overflow-hidden border-2 transition ${i === activeImg ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                    <img src={src} alt={`${room.name} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <Badge variant="secondary" className="mb-3">
              {soldOut ? 'Sold out today' : `${remaining} available today`}
            </Badge>
            <h1 className="text-headline mb-2">{room.name}</h1>
            <p className="text-body text-muted-foreground mb-6">{room.longDescription}</p>

            <div className="flex items-center gap-6 mb-6 text-sm">
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Up to {room.occupancy} guests</span>
              <span className="flex items-center gap-2"><BedDouble className="h-4 w-4 text-muted-foreground" /> {room.bedType}</span>
            </div>

            <div className="p-5 rounded-lg bg-muted mb-6">
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold">${room.basePrice}</span>
                <span className="text-muted-foreground text-sm pb-1">/ night</span>
              </div>
              <p className="text-xs text-muted-foreground">+ {(taxRate * 100).toFixed(0)}% taxes & fees</p>
            </div>

            <Button asChild size="lg" disabled={soldOut} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mb-6">
              <Link to={`/booking?room=${room.slug}`}>{soldOut ? 'Sold out — Check other dates' : 'Book This Room'}</Link>
            </Button>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">Room Amenities</h3>
              <div className="grid grid-cols-2 gap-2">
                {amenities.map(amenity => (
                  <span key={amenity} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-success" /> {amenity}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Policies</h3>
              <ul className="space-y-1.5">
                {policies.map(policy => (
                  <li key={policy} className="text-sm text-muted-foreground">{policy}</li>
                ))}
                <li className="text-sm text-muted-foreground">{cancellationTerms}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

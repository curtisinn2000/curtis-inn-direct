import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, BedDouble, Check, ArrowLeft, Loader2 } from 'lucide-react';
import roomImg from '@/assets/room-king.jpg';
import type { RoomType } from '@/types';
import { getRoomBySlug } from '@/services/api';

const DEFAULT_AMENITIES = ['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Private Bathroom'];
const DEFAULT_POLICIES = ['Non-smoking', 'No pets'];
const DEFAULT_CANCELLATION = 'Free cancellation up to 48 hours before check-in.';

export default function RoomDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadRoom() {
      if (!slug) {
        setRoom(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setActiveImg(0);
      try {
        const result = await getRoomBySlug(slug);
        if (!cancelled) setRoom(result);
      } catch (err) {
        if (!cancelled) {
          setRoom(null);
          setError(err instanceof Error ? err.message : 'Room type was not found.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRoom();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="section-padding container-narrow text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading room...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="section-padding container-narrow text-center">
        <h1 className="text-headline mb-4">Room not found</h1>
        {error && <p className="text-sm text-muted-foreground mb-6">{error}</p>}
        <Button asChild><Link to="/rooms">Back to rooms</Link></Button>
      </div>
    );
  }

  const amenities = room.amenities.length ? room.amenities : DEFAULT_AMENITIES;
  const policies = room.policies.length ? room.policies : DEFAULT_POLICIES;
  const cancellationTerms = room.cancellationTerms || DEFAULT_CANCELLATION;
  const visiblePolicies = policies.filter(policy => policy.trim().toLowerCase() !== cancellationTerms.trim().toLowerCase());
  const soldOut = room.inventoryCount === 0;
  const images = room.images.length ? room.images : [roomImg];

  return (
    <div className="section-padding">
      <div className="container-wide">
        <Link to="/rooms" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> All rooms
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
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

          <div>
            <Badge variant="secondary" className="mb-3">
              {soldOut ? 'Sold out' : `${room.inventoryCount} rooms online`}
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
              <p className="text-xs text-muted-foreground">+ {(room.taxRate * 100).toFixed(0)}% taxes & fees</p>
            </div>

            <Button asChild size="lg" disabled={soldOut} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mb-6">
              <Link to={`/booking?roomSlug=${room.slug}`}>{soldOut ? 'Sold out. Check other dates' : 'Book This Room'}</Link>
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
                {visiblePolicies.map(policy => (
                  <li key={policy} className="text-sm text-muted-foreground">{policy}</li>
                ))}
                {cancellationTerms && <li className="text-sm text-muted-foreground">{cancellationTerms}</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ElementType, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PROPERTY, AMENITIES_LIST } from '@/config/constants';
import { BookingWidget } from '@/components/booking/BookingWidget';
import { RatingBadgesRow } from '@/components/RatingBadgesRow';
import { RotatingGalleryMosaic } from '@/components/RotatingGalleryMosaic';
import { ScrollingPhotoRail } from '@/components/ScrollingPhotoRail';
import { Star, ArrowRight, Waves, Wifi, Car, Wind, WashingMachine, Flame, MapPin, Users, ChevronRight, Loader2 } from 'lucide-react';
import heroImg from '@/assets/hero-hotel.jpg';
import poolImg from '@/assets/pool.jpg';
import beachImg from '@/assets/beach.jpg';
import roomImg from '@/assets/room-king.jpg';
import type { RoomType, WebsiteContent } from '@/types';
import { getRoomTypes, getWebsiteContent } from '@/services/api';
import { fallbackContentImages, resolveContentImage } from '@/lib/contentImages';

const fallbackGallerySlides = [
  { src: heroImg, alt: 'Hotel exterior' },
  { src: poolImg, alt: 'Outdoor pool' },
  { src: roomImg, alt: 'King room interior' },
  { src: beachImg, alt: 'Hollywood Beach & Broadwalk' },
];

const railImages = [
  { src: heroImg, alt: 'Curtis Inn exterior' },
  { src: poolImg, alt: 'Pool area' },
  { src: roomImg, alt: 'Room interior' },
  { src: beachImg, alt: 'Hollywood Beach' },
  { src: heroImg, alt: 'Hotel entrance' },
  { src: poolImg, alt: 'Pool view' },
];

const iconMap: Record<string, ElementType> = {
  Waves, Wifi, Car, Wind, WashingMachine, Flame,
};

export default function HomePage() {
  const [featuredRooms, setFeaturedRooms] = useState<RoomType[]>([]);
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const hero = content?.hero;
  const featuredReviews = (content?.reviews ?? []).filter(r => r.isFeatured).slice(0, 4);
  const featuredFaqs = (content?.faqs ?? []).slice(0, 4);
  const featuredAttractions = (content?.attractions ?? []).slice(0, 3);
  const showAttractionMedia = featuredAttractions.some(attraction => attraction.image);
  const contentGallerySlides = buildGallerySlides(content?.gallery.map(image => ({
    src: resolveContentImage(image.url, fallbackContentImages.hero),
    alt: image.alt,
  })) ?? []);
  const contentRailImages = content?.gallery.length
    ? content.gallery.map(image => ({ src: resolveContentImage(image.url, fallbackContentImages.hero), alt: image.alt }))
    : railImages;

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      setRoomsLoading(true);
      setRoomsError('');
      try {
        const rooms = await getRoomTypes();
        if (!cancelled) setFeaturedRooms(rooms.slice(0, 4));
      } catch (err) {
        if (!cancelled) setRoomsError(err instanceof Error ? err.message : 'Unable to load rooms.');
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    }
    void loadRooms();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      try {
        const data = await getWebsiteContent();
        if (!cancelled) setContent(data);
      } catch {
        if (!cancelled) setContent(null);
      }
    }
    void loadContent();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        <img
          src={heroImg}
          alt="Curtis Inn & Suites exterior"
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        {/* Layered overlays for text legibility */}
        <div className="absolute inset-0 bg-foreground/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/40 to-foreground/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/40 via-foreground/15 to-transparent" />
        <div className="relative container-wide pb-24 pt-40 z-10">
          <div className="max-w-2xl">
            <p className="text-overline text-primary-foreground/80 mb-3 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.5)]">{hero?.heroSubtitle || 'Hollywood, Florida'}</p>
            <h1 className="text-display text-primary-foreground mb-4 [text-shadow:0_2px_24px_rgb(0_0_0_/_0.55)]">{PROPERTY.brandTitle}</h1>
            <p className="text-body-lg text-primary-foreground/95 mb-8 [text-shadow:0_1px_8px_rgb(0_0_0_/_0.6)]">
              {hero?.heroDescription || 'Affordable comfort steps from Hollywood Beach. Free parking, pool, and Wi-Fi - book direct for the best rates.'}
            </p>
            <p className="hidden">
              Affordable comfort steps from Hollywood Beach. Free parking, pool, and Wi-Fi — book direct for the best rates.
            </p>
            <div className="flex gap-3">
              <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg">
                <Link to="/booking">Book Your Stay</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-lg font-semibold">
                <Link to="/rooms">View Rooms</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Widget */}
      <section className="-mt-10 relative z-20 container-wide">
        <BookingWidget />
      </section>

      {/* OTA Rating Badges */}
      <RatingBadgesRow />

      {/* Property Highlights */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-overline mb-3">Why Curtis Inn</p>
              <h2 className="text-headline mb-6">Simple, honest, comfortable.</h2>
              <p className="text-body text-muted-foreground mb-6">
                Curtis Inn & Suites offers a straightforward, affordable stay in the heart of Hollywood, Florida.
                No gimmicks — just clean rooms, friendly service, and a prime location near the beach, shopping, and entertainment.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Free Parking', value: 'On-site' },
                  { label: 'To Beach', value: '< 1 mile' },
                  { label: 'Outdoor Pool', value: 'Open daily' },
                  { label: 'Free Wi-Fi', value: 'Property-wide' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <RotatingGalleryMosaic slides={contentGallerySlides} />
          </div>
        </div>
      </section>

      {/* Room Preview */}
      <section className="section-padding bg-muted/50">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-overline mb-2">Accommodations</p>
              <h2 className="text-headline">Choose your room</h2>
            </div>
            <Button variant="ghost" asChild className="hidden md:flex">
              <Link to="/rooms">View all rooms <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          {roomsLoading && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
              Loading rooms...
            </Card>
          )}
          {!roomsLoading && roomsError && (
            <Card className="p-8 text-center text-sm text-destructive">{roomsError}</Card>
          )}
          {!roomsLoading && !roomsError && featuredRooms.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredRooms.map(room => (
              <Link key={room.slug} to={`/room/${room.slug}`} className="block h-full">
                <Card className="h-full overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    <img src={room.images[0] ?? roomImg} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                  <div className="p-4 flex flex-1 flex-col">
                    <h3 className="font-semibold mb-1 min-h-[2.75rem] line-clamp-2">{room.name}</h3>
                    <p className="text-caption text-sm line-clamp-2 min-h-[2.75rem] mb-3">{room.shortDescription}</p>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div>
                        <span className="text-lg font-bold">${room.basePrice}</span>
                        <span className="text-caption text-xs"> / night</span>
                      </div>
                      <div className="flex items-center gap-1 text-caption text-xs">
                        <Users className="h-3 w-3" />
                        <span>{room.occupancy}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>}
          <div className="mt-6 md:hidden">
            <Button variant="outline" asChild className="w-full">
              <Link to="/rooms">View all rooms</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="text-center mb-12">
            <p className="text-overline mb-2">Amenities</p>
            <h2 className="text-headline">Everything you need</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {AMENITIES_LIST.map(amenity => {
              const Icon = iconMap[amenity.icon] || Waves;
              return (
                <div key={amenity.name} className="text-center p-6 rounded-lg hover:bg-muted transition-colors">
                  <Icon className="h-8 w-8 mx-auto mb-3 text-accent" />
                  <p className="font-medium text-sm">{amenity.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Gallery Preview — Scrolling Rail */}
      <section className="section-padding bg-muted/50">
        <div className="container-wide">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-overline mb-2">Gallery</p>
              <h2 className="text-headline">See for yourself</h2>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/gallery">View gallery <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
        <ScrollingPhotoRail images={contentRailImages} speed={35} />
      </section>

      {/* Nearby */}
      <section className="section-padding">
        <div className="container-wide">
          <div className="text-center mb-12">
            <p className="text-overline mb-2">Explore</p>
            <h2 className="text-headline">Nearby attractions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredAttractions.map(attraction => (
              <Card key={attraction.id} className="h-full overflow-hidden hover:shadow-md transition-shadow flex flex-col">
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
                <div className="p-6 flex flex-1 flex-col">
                  <div className="flex items-start gap-3 mb-3 min-h-[3.5rem]">
                    <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-semibold line-clamp-2">{attraction.name}</h3>
                      <p className="text-xs text-accent font-medium">{attraction.distance}</p>
                    </div>
                  </div>
                  <p className="text-caption text-sm line-clamp-3">{attraction.description}</p>
                </div>
              </Card>
            ))}
            {featuredAttractions.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground md:col-span-3">
                Nearby attractions will be added soon.
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container-wide">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-2">Guest Reviews</p>
            <h2 className="text-headline">What our guests say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredReviews.map(review => (
              <div key={review.id} className="p-6 rounded-lg bg-primary-foreground/5 min-h-[220px] h-full flex flex-col">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm opacity-90 mb-4 leading-relaxed line-clamp-5 flex-1">"{review.comment}"</p>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{review.guestName}</p>
                  <p className="text-xs opacity-50">{review.source}</p>
                </div>
              </div>
            ))}
            {featuredReviews.length === 0 && (
              <div className="p-6 rounded-lg bg-primary-foreground/5 text-sm opacity-80 lg:col-span-4">
                Guest reviews will be added soon.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="section-padding">
        <div className="container-narrow">
          <div className="text-center mb-12">
            <p className="text-overline mb-2">FAQ</p>
            <h2 className="text-headline">Common questions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredFaqs.map(faq => (
              <div key={faq.id} className="p-5 rounded-lg border hover:bg-muted/50 transition-colors h-full min-h-[150px] flex flex-col">
                <h3 className="font-medium mb-2 min-h-[3rem] line-clamp-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{faq.answer}</p>
              </div>
            ))}
            {featuredFaqs.length === 0 && (
              <div className="p-5 rounded-lg border text-center text-sm text-muted-foreground md:col-span-2">
                FAQ content will be added soon.
              </div>
            )}
          </div>
          <div className="text-center mt-8">
            <Button variant="outline" asChild>
              <Link to="/faq">View all FAQ <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-accent/10">
        <div className="container-narrow text-center">
          <h2 className="text-headline mb-4">Ready to book your stay?</h2>
          <p className="text-body text-muted-foreground mb-8 max-w-xl mx-auto">
            Book direct with Curtis Inn & Suites for the best rates. No middleman, no hidden fees.
          </p>
          <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/booking">Book Now</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function buildGallerySlides(uploadedSlides: Array<{ src: string; alt: string }>) {
  const uniqueSlides = [...uploadedSlides, ...fallbackGallerySlides].filter((slide, index, slides) => (
    Boolean(slide.src) && slides.findIndex(candidate => candidate.src === slide.src) === index
  ));
  return uniqueSlides.slice(0, Math.max(uploadedSlides.length, 3));
}

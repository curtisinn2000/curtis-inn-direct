import heroImg from '@/assets/hero-hotel.jpg';
import poolImg from '@/assets/pool.jpg';
import roomImg from '@/assets/room-king.jpg';
import beachImg from '@/assets/beach.jpg';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const categories = ['All', 'Exterior', 'Pool', 'Rooms', 'Area'] as const;
const images = [
  { src: heroImg, alt: 'Hotel exterior', category: 'Exterior' },
  { src: poolImg, alt: 'Pool area', category: 'Pool' },
  { src: roomImg, alt: 'King room', category: 'Rooms' },
  { src: beachImg, alt: 'Hollywood Beach', category: 'Area' },
  { src: heroImg, alt: 'Hotel entrance', category: 'Exterior' },
  { src: poolImg, alt: 'Pool view', category: 'Pool' },
  { src: roomImg, alt: 'Suite', category: 'Rooms' },
  { src: beachImg, alt: 'Broadwalk', category: 'Area' },
];

export default function GalleryPage() {
  const [filter, setFilter] = useState<string>('All');
  const filtered = filter === 'All' ? images : images.filter(i => i.category === filter);

  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <p className="text-overline mb-2">Gallery</p>
          <h1 className="text-headline">Explore our property</h1>
        </div>
        <div className="flex gap-2 mb-8 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn('px-4 py-2 text-sm rounded-full transition-colors', filter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((img, i) => (
            <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden group">
              <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import heroImg from '@/assets/hero-hotel.jpg';
import poolImg from '@/assets/pool.jpg';
import roomImg from '@/assets/room-king.jpg';
import beachImg from '@/assets/beach.jpg';

const bundledImages: Record<string, string> = {
  '/assets/hero-hotel.jpg': heroImg,
  '/assets/pool.jpg': poolImg,
  '/assets/room-king.jpg': roomImg,
  '/assets/beach.jpg': beachImg,
  hero: heroImg,
  pool: poolImg,
  room: roomImg,
  beach: beachImg,
};

export function resolveContentImage(url: string | undefined, fallback: string = heroImg) {
  if (!url) return fallback;
  return bundledImages[url] ?? url;
}

export const fallbackContentImages = {
  hero: heroImg,
  pool: poolImg,
  room: roomImg,
  beach: beachImg,
};

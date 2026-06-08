import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface RailImage {
  src: string;
  alt: string;
}

interface ScrollingPhotoRailProps {
  images: RailImage[];
  /** px per second */
  speed?: number;
  className?: string;
}

export function ScrollingPhotoRail({ images, speed = 30, className }: ScrollingPhotoRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // Keep ref in sync for rAF callback
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Duplicate images for infinite loop
  const doubled = [...images, ...images];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let raf: number;
    let lastTime = 0;
    let offset = 0;

    const tick = (time: number) => {
      if (!lastTime) lastTime = time;
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (!pausedRef.current) {
        offset += speed * dt;
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0 && offset >= halfWidth) offset -= halfWidth;
        track.style.transform = `translateX(-${offset}px)`;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <div
      className={cn('overflow-hidden relative', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Edge fade masks */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />

      <div ref={trackRef} className="flex gap-4 will-change-transform" style={{ width: 'max-content' }}>
        {doubled.map((img, i) => (
          <div key={i} className="shrink-0 w-72 md:w-80 lg:w-96 aspect-[4/3] rounded-lg overflow-hidden">
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface GallerySlide {
  src: string;
  alt: string;
}

interface AutoRotatingGalleryProps {
  slides: GallerySlide[];
  interval?: number;
  className?: string;
}

export function AutoRotatingGallery({ slides, interval = 4000, className }: AutoRotatingGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
  }, [paused, next, interval, slides.length]);

  return (
    <div
      className={cn('relative overflow-hidden rounded-lg', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <img
          key={i}
          src={slide.src}
          alt={slide.alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out',
            i === current ? 'opacity-100 z-10' : 'opacity-0 z-0',
          )}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-500 ease-out',
                i === current ? 'w-5 bg-primary-foreground/90' : 'w-1.5 bg-primary-foreground/30 hover:bg-primary-foreground/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

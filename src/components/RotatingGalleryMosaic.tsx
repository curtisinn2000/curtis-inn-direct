import { useEffect, useRef, useState } from 'react';

interface GallerySlide {
  src: string;
  alt: string;
}

interface RotatingGalleryMosaicProps {
  slides: GallerySlide[];
}

const PANEL_INTERVALS = [4000, 5000, 6000] as const;

function initialIndices(slideCount: number) {
  return [0, Math.min(1, slideCount - 1), Math.min(2, slideCount - 1)];
}

export function RotatingGalleryMosaic({ slides }: RotatingGalleryMosaicProps) {
  const [indices, setIndices] = useState(() => initialIndices(slides.length));
  const pausedPanels = useRef([false, false, false]);
  const slideSignature = slides.map(slide => slide.src).join('|');

  useEffect(() => {
    setIndices(initialIndices(slides.length));
  }, [slideSignature, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (slides.length === 3) {
      const timer = window.setInterval(() => {
        if (pausedPanels.current.some(Boolean)) return;
        setIndices(current => current.map(index => (index + 1) % slides.length));
      }, PANEL_INTERVALS[0]);
      return () => window.clearInterval(timer);
    }

    const timers = PANEL_INTERVALS.map((interval, panelIndex) => window.setInterval(() => {
      if (pausedPanels.current[panelIndex]) return;
      setIndices(current => {
        const occupied = new Set(current.filter((_, index) => index !== panelIndex));
        let nextIndex = (current[panelIndex] + 1) % slides.length;
        while (occupied.has(nextIndex)) nextIndex = (nextIndex + 1) % slides.length;
        const next = [...current];
        next[panelIndex] = nextIndex;
        return next;
      });
    }, interval));

    return () => timers.forEach(timer => window.clearInterval(timer));
  }, [slides.length]);

  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Curtis Inn photo gallery">
      {indices.map((slideIndex, panelIndex) => {
        const slide = slides[slideIndex];
        const isWide = panelIndex === 2;
        return (
          <figure
            key={panelIndex}
            className={`group relative overflow-hidden rounded-lg bg-muted ${isWide ? 'col-span-2 aspect-[16/7]' : 'aspect-[4/3]'}`}
            onMouseEnter={() => { pausedPanels.current[panelIndex] = true; }}
            onMouseLeave={() => { pausedPanels.current[panelIndex] = false; }}
            onFocus={() => { pausedPanels.current[panelIndex] = true; }}
            onBlur={() => { pausedPanels.current[panelIndex] = false; }}
          >
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full animate-fade-in object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              loading={panelIndex === 0 ? 'eager' : 'lazy'}
            />
            <figcaption className="sr-only">{slide.alt}</figcaption>
            {slides.length > 1 && (
              <span className="absolute bottom-3 right-3 rounded-sm bg-foreground/70 px-2 py-1 text-[10px] font-semibold text-background backdrop-blur-sm">
                {slideIndex + 1} / {slides.length}
              </span>
            )}
          </figure>
        );
      })}
    </div>
  );
}

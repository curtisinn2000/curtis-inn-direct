import { OTA_RATINGS } from '@/data/ratingsData';
import { Star } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function RatingBadgesRow() {
  return (
    <section className="py-8">
      <div className="container-wide">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
            Rated by travelers
          </span>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <TooltipProvider>
              {OTA_RATINGS.map((r) => (
                <Tooltip key={r.provider}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-card px-4 py-2 text-sm transition-colors hover:border-border hover:shadow-sm cursor-default">
                      <Star className="h-3 w-3 fill-accent text-accent" />
                      <span className="font-semibold text-foreground/80 text-xs">{r.provider}</span>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {r.rating}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        /{r.scale} · {r.reviewCount.toLocaleString()}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                    {r.rating}/{r.scale} from {r.reviewCount.toLocaleString()} review{r.reviewCount !== 1 ? 's' : ''} on {r.provider}
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      </div>
    </section>
  );
}

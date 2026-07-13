import { OTA_RATINGS } from '@/data/ratingsData';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function RatingBadgesRow() {
  return (
    <section className="border-b border-border/60 bg-card py-7" aria-label="Traveller ratings">
      <div className="container-wide">
        <div className="flex flex-col items-center justify-center gap-5 lg:flex-row lg:gap-8">
          <span className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Rated by travellers
          </span>
          <TooltipProvider>
            <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-3">
              {OTA_RATINGS.map(r => (
                <Tooltip key={r.provider}>
                  <TooltipTrigger asChild>
                    <div className="flex min-h-14 cursor-default items-center justify-between gap-4 rounded-lg border border-border/70 bg-background px-4 py-3 shadow-sm transition-[border-color,box-shadow] hover:border-accent/60 hover:shadow-md sm:min-w-[210px]">
                      <img src={r.logo} alt={`${r.provider} logo`} className="h-6 w-auto max-w-[105px] object-contain" />
                      <div className="flex shrink-0 items-baseline gap-1 border-l pl-3">
                        <span className="text-base font-bold text-foreground">{r.rating}</span>
                        <span className="text-[10px] text-muted-foreground">/{r.scale}</span>
                      </div>
                      <span className="sr-only">{r.reviewCount.toLocaleString()} reviews</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    {r.rating}/{r.scale} from {r.reviewCount.toLocaleString()} review{r.reviewCount !== 1 ? 's' : ''} on {r.provider}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  );
}

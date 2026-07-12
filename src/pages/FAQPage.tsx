import { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { FAQ } from '@/types';
import { getWebsiteContent } from '@/services/api';

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const categories = useMemo(() => [...new Set(faqs.map(faq => faq.category))], [faqs]);

  useEffect(() => {
    let cancelled = false;
    async function loadFaqs() {
      setLoading(true);
      setError('');
      try {
        const content = await getWebsiteContent();
        if (!cancelled) setFaqs(content.faqs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load FAQ.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadFaqs();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="section-padding">
      <div className="container-narrow">
        <div className="mb-10 text-center">
          <p className="text-overline mb-2">Support</p>
          <h1 className="text-headline mb-4">Frequently Asked Questions</h1>
          <p className="text-body text-muted-foreground">Find answers to common questions about your stay.</p>
        </div>

        {loading && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
            Loading FAQ...
          </Card>
        )}

        {!loading && error && <Card className="p-8 text-center text-sm text-destructive">{error}</Card>}

        {!loading && !error && categories.map(category => (
          <div key={category} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{category}</h2>
            <Accordion type="single" collapsible>
              {faqs.filter(faq => faq.category === category).map(faq => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}

        {!loading && !error && faqs.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">FAQ content will be added soon.</Card>
        )}
      </div>
    </div>
  );
}

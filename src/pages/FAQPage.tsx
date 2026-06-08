import { MOCK_FAQS } from '@/data/mock-data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function FAQPage() {
  const categories = [...new Set(MOCK_FAQS.map(f => f.category))];

  return (
    <div className="section-padding">
      <div className="container-narrow">
        <div className="mb-10 text-center">
          <p className="text-overline mb-2">Support</p>
          <h1 className="text-headline mb-4">Frequently Asked Questions</h1>
          <p className="text-body text-muted-foreground">Find answers to common questions about your stay.</p>
        </div>
        {categories.map(cat => (
          <div key={cat} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">{cat}</h2>
            <Accordion type="single" collapsible>
              {MOCK_FAQS.filter(f => f.category === cat).map(faq => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    </div>
  );
}

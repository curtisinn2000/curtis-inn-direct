import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PROPERTY } from '@/config/constants';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { useState } from 'react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="section-padding">
      <div className="container-wide">
        <div className="mb-10">
          <p className="text-overline mb-2">Get in Touch</p>
          <h1 className="text-headline mb-4">Contact Us</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            {submitted ? (
              <Card className="p-8 text-center animate-scale-in">
                <h2 className="text-title mb-2">Message Sent!</h2>
                <p className="text-muted-foreground mb-4">We'll get back to you as soon as possible.</p>
                <Button onClick={() => setSubmitted(false)} variant="outline">Send Another</Button>
              </Card>
            ) : (
              <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label>Name *</Label><Input required /></div>
                    <div><Label>Email *</Label><Input type="email" required /></div>
                  </div>
                  <div><Label>Subject</Label><Input /></div>
                  <div><Label>Message *</Label><Textarea required rows={5} /></div>
                  <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Send Message</Button>
                </form>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {[
              { icon: MapPin, label: 'Address', value: PROPERTY.address },
              { icon: Phone, label: 'Phone', value: PROPERTY.phone },
              { icon: Mail, label: 'Email', value: PROPERTY.email },
              { icon: Clock, label: 'Front Desk', value: 'Available 24/7' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-muted"><item.icon className="h-5 w-5 text-accent" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { PROPERTY } from '@/config/constants';
import { getHotelPolicies } from '@/services/api';
import type { HotelPolicies } from '@/types';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<HotelPolicies | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getHotelPolicies()
      .then(setPolicies)
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Policies could not be loaded.'));
  }, []);

  const entries = policies ? [
    ['Check-in', policies.checkInTime],
    ['Check-out', policies.checkOutTime],
    ['Minimum check-in age', `${policies.minimumCheckInAge} years`],
    ['Cancellation', `${policies.cancellationWindowHours}-hour cancellation window. ${policies.cancellationRule}`],
    ['No-show', policies.noShowPolicy],
    ['Deposit and payment', policies.depositPolicy],
    ['Smoking', policies.smokingPolicy],
    ['Pets', policies.petPolicy],
    ['Incidentals and security deposit', policies.incidentalsPolicy],
    ['Accepted payments', policies.acceptedPayments.join(', ')],
    ['Early check-in', policies.earlyCheckInPolicy],
    ['Late checkout', policies.lateCheckoutPolicy],
    ...(policies.guestFacingNotes ? [['Additional information', policies.guestFacingNotes]] : []),
  ] : [];

  return <div className="section-padding"><div className="container-narrow"><div className="mb-10 text-center"><p className="text-overline mb-2">Information</p><h1 className="text-headline mb-4">Hotel Policies</h1><p className="text-body text-muted-foreground">Please review our policies before your stay at {PROPERTY.name}.</p></div>{error ? <p className="text-center text-sm text-destructive">{error}</p> : !policies ? <p className="text-center text-sm text-muted-foreground">Loading policies...</p> : <div className="grid gap-4 md:grid-cols-2">{entries.map(([label, value]) => <div key={label} className="rounded-lg border p-5"><h2 className="mb-1 text-sm font-semibold">{label}</h2><p className="text-sm text-muted-foreground">{value}</p></div>)}</div>}</div></div>;
}

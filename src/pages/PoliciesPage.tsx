import { POLICIES, PROPERTY } from '@/config/constants';

export default function PoliciesPage() {
  const policyEntries = Object.entries(POLICIES).map(([key, value]) => ({
    label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
    value,
  }));

  return (
    <div className="section-padding">
      <div className="container-narrow">
        <div className="mb-10 text-center">
          <p className="text-overline mb-2">Information</p>
          <h1 className="text-headline mb-4">Hotel Policies</h1>
          <p className="text-body text-muted-foreground">Please review our policies before your stay at {PROPERTY.name}.</p>
        </div>
        <div className="space-y-4">
          {policyEntries.map(p => (
            <div key={p.label} className="p-5 rounded-lg border">
              <h3 className="font-semibold mb-1 text-sm">{p.label}</h3>
              <p className="text-sm text-muted-foreground">{p.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

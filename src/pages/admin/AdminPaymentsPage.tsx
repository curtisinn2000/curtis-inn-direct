import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPayments } from '@/services/api';
import type { Payment } from '@/types';
import { Download, Loader2 } from 'lucide-react';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPayments().then(setPayments).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Payments</h1>
          <p className="text-sm text-muted-foreground">{payments.length} transactions</p>
        </div>
        <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
      </div>

      {loading ? (
        <div className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Guest</th>
                <th className="text-left p-3 font-medium">Confirmation</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Method</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Stripe Ref</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(pay => (
                <tr key={pay.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{pay.guestName}</td>
                  <td className="p-3 font-mono text-xs">{pay.confirmationNumber}</td>
                  <td className="p-3 font-semibold">${pay.amount.toFixed(2)}</td>
                  <td className="p-3 capitalize text-xs">{pay.method.replace(/_/g, ' ')}</td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs">{pay.status}</Badge></td>
                  <td className="p-3 font-mono text-xs">{pay.stripePaymentIntentId || pay.stripeCheckoutSessionId || pay.cloverTransactionRef || '-'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(pay.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}

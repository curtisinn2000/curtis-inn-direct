import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MOCK_PAYMENTS } from '@/data/mock-data';
import { Download } from 'lucide-react';

export default function AdminPaymentsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-title">Payments</h1>
          <p className="text-sm text-muted-foreground">{MOCK_PAYMENTS.length} transactions</p>
        </div>
        <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
      </div>

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
                <th className="text-left p-3 font-medium">Clover Ref</th>
                <th className="text-left p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PAYMENTS.map(pay => (
                <tr key={pay.id} className="border-t hover:bg-muted/50">
                  <td className="p-3 font-medium">{pay.guestName}</td>
                  <td className="p-3 font-mono text-xs">{pay.confirmationNumber}</td>
                  <td className="p-3 font-semibold">${pay.amount.toFixed(2)}</td>
                  <td className="p-3 capitalize text-xs">{pay.method.replace(/_/g, ' ')}</td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs">{pay.status}</Badge></td>
                  <td className="p-3 font-mono text-xs">{pay.cloverTransactionRef || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(pay.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

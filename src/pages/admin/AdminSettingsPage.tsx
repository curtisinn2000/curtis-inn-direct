import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PROPERTY } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { getAuditLogs } from '@/services/api';
import type { AuditLog } from '@/types';

export default function AdminSettingsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    getAuditLogs().then(setAuditLogs).catch(() => setAuditLogs([]));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage admin profile and system settings</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-6 space-y-4 max-w-lg">
            <div><Label>Name</Label><Input defaultValue="Front Desk Manager" /></div>
            <div><Label>Email</Label><Input type="email" defaultValue="admin@curtisinnsuites.com" /></div>
            <div><Label>Role</Label><Input defaultValue="Owner" disabled /></div>
            <Button>Save Profile</Button>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card className="p-6 space-y-4 max-w-lg">
            <p className="text-sm text-muted-foreground">Configure email sending for booking confirmations and notifications.</p>
            <div><Label>Sender Email</Label><Input defaultValue={PROPERTY.email} /></div>
            <div><Label>Reply-To Email</Label><Input defaultValue={PROPERTY.email} /></div>
            <div><Label>SMTP / Gmail API</Label><Input placeholder="Configure in backend" disabled /></div>
            <Badge variant="secondary">Placeholder — connect backend email service</Badge>
            <Button>Save Settings</Button>
          </Card>
        </TabsContent>

        <TabsContent value="stripe">
          <Card className="p-6 space-y-4 max-w-lg">
            <p className="text-sm text-muted-foreground">Stripe payment integration settings.</p>
            <div><Label>Mode</Label><Input defaultValue="Test" disabled /></div>
            <div><Label>Webhook Endpoint</Label><Input defaultValue="/api/stripe/webhook" disabled /></div>
            <Badge variant="secondary">Configured with GCP Secret Manager</Badge>
            <Button>Save Settings</Button>
          </Card>
        </TabsContent>

        <TabsContent value="policies">
          <Card className="p-6 space-y-4 max-w-lg">
            <div><Label>Check-in Time</Label><Input defaultValue={PROPERTY.checkIn} /></div>
            <div><Label>Check-out Time</Label><Input defaultValue={PROPERTY.checkOut} /></div>
            <div><Label>Cancellation Policy</Label><Input defaultValue="Free cancellation up to 48 hours before check-in" /></div>
            <div><Label>Minimum Check-in Age</Label><Input defaultValue="21" /></div>
            <Button>Save Policies</Button>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Admin</th>
                  <th className="text-left p-3 font-medium">Action</th>
                  <th className="text-left p-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => (
                  <tr key={log.id} className="border-t">
                    <td className="p-3 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="p-3">{log.adminName}</td>
                    <td className="p-3"><Badge variant="secondary" className="text-xs">{log.action}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

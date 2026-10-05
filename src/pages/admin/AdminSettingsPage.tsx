import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Send, ShieldCheck, UserPlus, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_PERMISSIONS } from '@/config/adminPermissions';
import { hasAdminPermission, useAdminSession } from '@/contexts/AdminSessionContext';
import {
  changeAdminPassword, getAdminAccounts, getAdminHotelPolicies, getAdminProfile, getAdminRoles,
  getAuditLogs, getIntegrationSettings, inviteAdminUser, resendAdminInvitation, testIntegration,
  updateAdminProfile, updateAdminUserRole, updateAdminUserStatus, updateEmailIntegration,
  updateHotelPolicies, updateStripeIntegration,
} from '@/services/api';
import type { AdminAccount, AdminRoleDefinition, AuditLog, HotelPolicies, IntegrationSettings } from '@/types';

type Profile = Awaited<ReturnType<typeof getAdminProfile>>;

export default function AdminSettingsPage() {
  const { user, refresh } = useAdminSession();
  const { toast } = useToast();
  const canManageUsers = hasAdminPermission(user, ADMIN_PERMISSIONS.usersManage);
  const canManagePolicies = hasAdminPermission(user, ADMIN_PERMISSIONS.policiesManage);
  const canViewPolicies = hasAdminPermission(user, ADMIN_PERMISSIONS.policiesRead);
  const canManageIntegrations = hasAdminPermission(user, ADMIN_PERMISSIONS.integrationsManage);
  const canViewIntegrations = hasAdminPermission(user, ADMIN_PERMISSIONS.integrationsRead);
  const canViewAudit = hasAdminPermission(user, ADMIN_PERMISSIONS.auditRead);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<AdminRoleDefinition[]>([]);
  const [policies, setPolicies] = useState<HotelPolicies | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [profileResult, accountResult, roleResult, policyResult, integrationResult, auditResult] = await Promise.all([
        getAdminProfile(),
        canManageUsers ? getAdminAccounts() : Promise.resolve([]),
        canManageUsers ? getAdminRoles() : Promise.resolve([]),
        canViewPolicies ? getAdminHotelPolicies() : Promise.resolve(null),
        canViewIntegrations ? getIntegrationSettings() : Promise.resolve(null),
        canViewAudit ? getAuditLogs() : Promise.resolve([]),
      ]);
      setProfile(profileResult); setAccounts(accountResult); setRoles(roleResult);
      setPolicies(policyResult); setIntegrations(integrationResult); setAuditLogs(auditResult);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Settings could not be loaded', description: errorMessage(error) });
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading settings...</div>;

  return <div className="space-y-6">
    <div><h1 className="text-title">Settings</h1><p className="text-sm text-muted-foreground">Manage your profile, hotel operations and secured system access.</p></div>
    <Tabs defaultValue="profile">
      <TabsList className="mb-6 h-auto flex-wrap justify-start">
        <TabsTrigger value="profile">My Profile</TabsTrigger>
        {canManageUsers && <TabsTrigger value="users">Users &amp; Access</TabsTrigger>}
        {canViewPolicies && <TabsTrigger value="policies">Policies</TabsTrigger>}
        {canViewIntegrations && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
        {canViewAudit && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
      </TabsList>
      <TabsContent value="profile"><ProfilePanel profile={profile} onSaved={async () => { await load(); await refresh(); }} /></TabsContent>
      {canManageUsers && <TabsContent value="users"><UsersPanel accounts={accounts} roles={roles} currentUserId={user.id} onChanged={load} /></TabsContent>}
      {canViewPolicies && policies && <TabsContent value="policies"><PoliciesPanel policies={policies} canEdit={canManagePolicies} onSaved={setPolicies} /></TabsContent>}
      {canViewIntegrations && integrations && <TabsContent value="integrations"><IntegrationsPanel integrations={integrations} canEdit={canManageIntegrations} onChanged={load} /></TabsContent>}
      {canViewAudit && <TabsContent value="audit"><AuditPanel logs={auditLogs} /></TabsContent>}
    </Tabs>
  </div>;
}

function ProfilePanel({ profile, onSaved }: { profile: Profile | null; onSaved: () => Promise<void> }) {
  const { toast } = useToast();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(profile?.displayName ?? ''), [profile]);
  const saveProfile = async () => { setSaving(true); try { await updateAdminProfile(name); await onSaved(); toast({ title: 'Profile updated' }); } catch (error) { toast({ variant: 'destructive', title: 'Profile was not updated', description: errorMessage(error) }); } finally { setSaving(false); } };
  const savePassword = async () => { setSaving(true); try { await changeAdminPassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); toast({ title: 'Password updated' }); } catch (error) { toast({ variant: 'destructive', title: 'Password was not updated', description: errorMessage(error) }); } finally { setSaving(false); } };
  return <div className="grid gap-5 xl:grid-cols-2">
    <Card className="p-6 space-y-4"><div><h2 className="font-semibold">Profile</h2><p className="text-sm text-muted-foreground">Your identity in audit history and admin activity.</p></div><div><Label>Name</Label><Input value={name} onChange={event => setName(event.target.value)} /></div><div><Label>Email</Label><Input value={profile?.email ?? ''} disabled /><p className="mt-1 text-xs text-muted-foreground">Contact an Owner to change your sign-in email.</p></div><div><Label>Role</Label><Input value={profile?.roleNames.join(', ') ?? ''} disabled /></div><Button onClick={saveProfile} disabled={saving || name.trim().length < 2}>Save profile</Button></Card>
    <Card className="p-6 space-y-4"><div><h2 className="font-semibold">Password</h2><p className="text-sm text-muted-foreground">Use at least 12 characters and do not share it.</p></div><div><Label>Current password</Label><Input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div><div><Label>New password</Label><Input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></div><Button onClick={savePassword} disabled={saving || !currentPassword || newPassword.length < 12}>Change password</Button></Card>
  </div>;
}

function UsersPanel({ accounts, roles, currentUserId, onChanged }: { accounts: AdminAccount[]; roles: AdminRoleDefinition[]; currentUserId: string; onChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState({ displayName: '', email: '', roleKey: 'front_desk' });
  const [busyId, setBusyId] = useState('');
  const run = async (id: string, action: () => Promise<unknown>, success: string) => { setBusyId(id); try { await action(); await onChanged(); toast({ title: success }); } catch (error) { toast({ variant: 'destructive', title: 'Action failed', description: errorMessage(error) }); } finally { setBusyId(''); } };
  const submitInvite = async () => { await run('invite', () => inviteAdminUser(invite), 'Invitation sent'); setOpen(false); setInvite({ displayName: '', email: '', roleKey: 'front_desk' }); };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Admin accounts</h2><p className="text-sm text-muted-foreground">Access is enforced by the backend on every protected request.</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" />Invite user</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Invite admin user</DialogTitle><DialogDescription>The recipient has 72 hours to create a private password.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div><Label>Name</Label><Input value={invite.displayName} onChange={event => setInvite(value => ({ ...value, displayName: event.target.value }))} /></div><div><Label>Email</Label><Input type="email" value={invite.email} onChange={event => setInvite(value => ({ ...value, email: event.target.value }))} /></div><div><Label>Role</Label><Select value={invite.roleKey} onValueChange={roleKey => setInvite(value => ({ ...value, roleKey }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map(role => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submitInvite} disabled={busyId === 'invite' || !invite.displayName || !invite.email}><Send className="mr-2 h-4 w-4" />Send invitation</Button></DialogFooter></DialogContent></Dialog></div>
    <div className="grid gap-3">{accounts.map(account => <Card key={account.id} className="p-4"><div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_180px_150px_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{account.displayName}</p>{account.invitationPending && <Badge variant="secondary">Invitation pending</Badge>}</div><p className="truncate text-sm text-muted-foreground">{account.email}</p><p className="mt-1 text-xs text-muted-foreground">Last login: {formatDate(account.lastLoginAt, 'Never')}</p></div><Select value={account.roleKey} disabled={busyId === account.id} onValueChange={roleKey => run(account.id, () => updateAdminUserRole(account.id, roleKey), 'Role updated')}><SelectTrigger aria-label={`Role for ${account.displayName}`}><SelectValue /></SelectTrigger><SelectContent>{roles.map(role => <SelectItem key={role.key} value={role.key}>{role.name}</SelectItem>)}</SelectContent></Select><div className="flex items-center gap-3"><Switch checked={account.isActive} disabled={busyId === account.id || account.id === currentUserId || account.invitationPending} onCheckedChange={isActive => run(account.id, () => updateAdminUserStatus(account.id, isActive), isActive ? 'Account reactivated' : 'Account deactivated')} /><span className={account.isActive ? 'text-sm text-green-700' : 'text-sm text-muted-foreground'}>{account.isActive ? 'Active' : 'Inactive'}</span></div><div className="flex justify-end">{account.invitationPending && <Button variant="outline" size="sm" disabled={busyId === account.id} onClick={() => run(account.id, () => resendAdminInvitation(account.id), 'Invitation resent')}><Mail className="mr-2 h-4 w-4" />Resend</Button>}</div></div></Card>)}</div>
    <div><h3 className="mb-3 font-semibold">Role access</h3><div className="grid gap-3 lg:grid-cols-3">{roles.map(role => <Card key={role.key} className="p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><h4 className="font-medium">{role.name}</h4></div><p className="mt-2 text-sm text-muted-foreground">{role.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{role.permissions.map(permission => <Badge key={permission} variant="secondary" className="font-normal">{friendlyPermission(permission)}</Badge>)}</div></Card>)}</div></div>
  </div>;
}

function PoliciesPanel({ policies, canEdit, onSaved }: { policies: HotelPolicies; canEdit: boolean; onSaved: (value: HotelPolicies) => void }) {
  const { toast } = useToast(); const [value, setValue] = useState(policies); const [saving, setSaving] = useState(false);
  const field = (key: keyof HotelPolicies, label: string, rows = 2) => <div><Label>{label}</Label><Textarea rows={rows} value={String(value[key] ?? '')} disabled={!canEdit} onChange={event => setValue(current => ({ ...current, [key]: event.target.value }))} /></div>;
  const save = async () => { setSaving(true); try { const saved = await updateHotelPolicies(value); setValue(saved); onSaved(saved); toast({ title: 'Hotel policies updated' }); } catch (error) { toast({ variant: 'destructive', title: 'Policies were not updated', description: errorMessage(error) }); } finally { setSaving(false); } };
  return <Card className="p-6 space-y-6"><div><h2 className="font-semibold">Hotel policy configuration</h2><p className="text-sm text-muted-foreground">These policies are used by the public Policies page and operational staff.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div><Label>Check-in time</Label><Input value={value.checkInTime} disabled={!canEdit} onChange={event => setValue(current => ({ ...current, checkInTime: event.target.value }))} /></div><div><Label>Check-out time</Label><Input value={value.checkOutTime} disabled={!canEdit} onChange={event => setValue(current => ({ ...current, checkOutTime: event.target.value }))} /></div><div><Label>Minimum check-in age</Label><Input type="number" min={18} max={99} value={value.minimumCheckInAge} disabled={!canEdit} onChange={event => setValue(current => ({ ...current, minimumCheckInAge: Number(event.target.value) }))} /></div><div><Label>Cancellation window (hours)</Label><Input type="number" min={0} value={value.cancellationWindowHours} disabled={!canEdit} onChange={event => setValue(current => ({ ...current, cancellationWindowHours: Number(event.target.value) }))} /></div></div><div className="grid gap-4 lg:grid-cols-2">{field('cancellationRule', 'Cancellation rule')}{field('noShowPolicy', 'No-show policy')}{field('depositPolicy', 'Deposit and payment policy')}{field('incidentalsPolicy', 'Incidentals and security deposit')}{field('smokingPolicy', 'Smoking policy')}{field('petPolicy', 'Pet policy')}{field('earlyCheckInPolicy', 'Early check-in')}{field('lateCheckoutPolicy', 'Late checkout')}</div><div><Label>Accepted payments</Label><Input value={value.acceptedPayments.join(', ')} disabled={!canEdit} onChange={event => setValue(current => ({ ...current, acceptedPayments: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} /><p className="mt-1 text-xs text-muted-foreground">Separate payment types with commas.</p></div>{field('guestFacingNotes', 'Additional guest-facing notes', 4)}{canEdit && <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save policies'}</Button>}</Card>;
}

function IntegrationsPanel({ integrations, canEdit, onChanged }: { integrations: IntegrationSettings; canEdit: boolean; onChanged: () => Promise<void> }) {
  const { toast } = useToast();
  const [email, setEmail] = useState({ smtpHost: String(integrations.email.fields.smtpHost ?? ''), smtpPort: Number(integrations.email.fields.smtpPort ?? 587), smtpUser: String(integrations.email.fields.smtpUser ?? ''), mailFrom: String(integrations.email.fields.mailFrom ?? ''), hotelNotificationsEmail: String(integrations.email.fields.hotelNotificationsEmail ?? ''), smtpPassword: '' });
  const [stripe, setStripe] = useState({ mode: String(integrations.stripe.fields.mode ?? 'test'), secretKey: '', webhookSecret: '' });
  const [busy, setBusy] = useState('');
  const run = async (key: string, action: () => Promise<{ message?: string } | unknown>, success: string) => { setBusy(key); try { const result = await action() as { message?: string }; await onChanged(); toast({ title: result.message ?? success }); } catch (error) { toast({ variant: 'destructive', title: 'Integration action failed', description: errorMessage(error) }); } finally { setBusy(''); } };
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">Secrets are written directly to Google Secret Manager and are never returned. Non-secret values are saved as deployment configuration metadata. Apply those values to Cloud Run and deploy a new revision before testing replacements.</p><div className="grid gap-5 xl:grid-cols-2"><Card className="p-6 space-y-4"><IntegrationHeader name="Email" status={integrations.email} /><div className="grid gap-4 sm:grid-cols-2"><div><Label>SMTP host</Label><Input value={email.smtpHost} disabled={!canEdit} onChange={event => setEmail(current => ({ ...current, smtpHost: event.target.value }))} /></div><div><Label>SMTP port</Label><Input type="number" value={email.smtpPort} disabled={!canEdit} onChange={event => setEmail(current => ({ ...current, smtpPort: Number(event.target.value) }))} /></div></div><div><Label>SMTP user</Label><Input value={email.smtpUser} disabled={!canEdit} onChange={event => setEmail(current => ({ ...current, smtpUser: event.target.value }))} /></div><div><Label>Sender email</Label><Input value={email.mailFrom} disabled={!canEdit} onChange={event => setEmail(current => ({ ...current, mailFrom: event.target.value }))} /></div><div><Label>Hotel notification email</Label><Input value={email.hotelNotificationsEmail} disabled={!canEdit} onChange={event => setEmail(current => ({ ...current, hotelNotificationsEmail: event.target.value }))} /></div><div><Label>SMTP password</Label><Input type="password" value={email.smtpPassword} disabled={!canEdit} placeholder={String(integrations.email.fields.smtpPassword || 'Not configured')} onChange={event => setEmail(current => ({ ...current, smtpPassword: event.target.value }))} /><p className="mt-1 text-xs text-muted-foreground">Write-only. Leave blank to keep the current secret.</p></div>{canEdit && <div className="flex flex-wrap gap-2"><Button disabled={busy !== ''} onClick={() => run('save-email', () => updateEmailIntegration(email), 'Email settings saved')}>Save email</Button><Button variant="outline" disabled={busy !== ''} onClick={() => run('test-email', () => testIntegration('email'), 'Email connection verified')}>Test email</Button></div>}</Card>
    <Card className="p-6 space-y-4"><IntegrationHeader name="Stripe" status={integrations.stripe} /><div><Label>Mode</Label><Select value={stripe.mode} disabled={!canEdit} onValueChange={mode => setStripe(current => ({ ...current, mode }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="test">Test</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent></Select></div><div><Label>Webhook endpoint</Label><Input value={String(integrations.stripe.fields.webhookEndpoint ?? '')} disabled /></div><div><Label>Secret key</Label><Input type="password" value={stripe.secretKey} disabled={!canEdit} placeholder={String(integrations.stripe.fields.secretKey || 'Not configured')} onChange={event => setStripe(current => ({ ...current, secretKey: event.target.value }))} /><p className="mt-1 text-xs text-muted-foreground">Write-only. The saved value is never returned.</p></div><div><Label>Webhook signing secret</Label><Input type="password" value={stripe.webhookSecret} disabled={!canEdit} placeholder={String(integrations.stripe.fields.webhookSecret || 'Not configured')} onChange={event => setStripe(current => ({ ...current, webhookSecret: event.target.value }))} /></div>{canEdit && <div className="flex flex-wrap gap-2"><Button disabled={busy !== ''} onClick={() => run('save-stripe', () => updateStripeIntegration(stripe), 'Stripe settings saved')}>Save Stripe</Button><Button variant="outline" disabled={busy !== ''} onClick={() => run('test-stripe', () => testIntegration('stripe'), 'Stripe connection verified')}>Test connection</Button></div>}</Card></div></div>;
}

function IntegrationHeader({ name, status }: { name: string; status: IntegrationSettings['email'] }) { return <div><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{name}</h2><Badge variant={status.configured ? 'default' : 'secondary'}>{status.configured ? 'Configured' : 'Not configured'}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Last updated: {formatDate(status.lastUpdatedAt, 'No admin update recorded')}</p>{status.lastTestStatus && <div className="mt-2 flex items-center gap-1.5 text-xs">{status.lastTestStatus === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}Last test {status.lastTestStatus} on {formatDate(status.lastTestedAt, 'unknown')}</div>}</div>; }
function AuditPanel({ logs }: { logs: AuditLog[] }) { return <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted"><tr><th className="p-3 text-left font-medium">Date</th><th className="p-3 text-left font-medium">Admin</th><th className="p-3 text-left font-medium">Action</th><th className="p-3 text-left font-medium">Details</th></tr></thead><tbody>{logs.map(log => <tr key={log.id} className="border-t"><td className="p-3 text-xs text-muted-foreground">{formatDate(log.createdAt, '')}</td><td className="p-3">{log.adminName}</td><td className="p-3"><Badge variant="secondary" className="text-xs">{log.action}</Badge></td><td className="p-3 text-xs text-muted-foreground">{log.details}</td></tr>)}</tbody></table></div></Card>; }
function formatDate(value: string | null | undefined, fallback: string) { return value ? new Date(value).toLocaleString() : fallback; }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function friendlyPermission(permission: string) { return permission.replace('.', ': ').replace(/_/g, ' '); }

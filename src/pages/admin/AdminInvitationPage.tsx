import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptAdminInvitation, inspectAdminInvitation } from '@/services/api';

type Invitation = Awaited<ReturnType<typeof inspectAdminInvitation>>;

export default function AdminInvitationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    inspectAdminInvitation(token)
      .then(result => {
        setInvitation(result);
        setDisplayName(result.displayName);
      })
      .catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Invitation could not be loaded.'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setSaving(true);
    setError('');
    try {
      await acceptAdminInvitation({ token, displayName, password });
      navigate('/admin/login', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Account could not be activated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">Create your admin account</h1>
        {loading ? <p className="mt-4 text-sm text-muted-foreground">Checking invitation...</p> : error && !invitation ? (
          <div className="mt-4 space-y-4"><p className="text-sm text-destructive">{error}</p><Button asChild variant="outline"><Link to="/admin/login">Return to sign in</Link></Button></div>
        ) : invitation ? (
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{invitation.email}</p>
              <p className="text-muted-foreground">Role: {invitation.roleName}</p>
            </div>
            <div><Label htmlFor="invite-name">Name</Label><Input id="invite-name" value={displayName} onChange={event => setDisplayName(event.target.value)} required minLength={2} /></div>
            <div><Label htmlFor="invite-password">Password</Label><Input id="invite-password" type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={12} /><p className="mt-1 text-xs text-muted-foreground">Use at least 12 characters.</p></div>
            <div><Label htmlFor="invite-confirm">Confirm password</Label><Input id="invite-confirm" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required minLength={12} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Activating...' : 'Activate account'}</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}

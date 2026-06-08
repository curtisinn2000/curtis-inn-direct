import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { PROPERTY } from '@/config/constants';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">{PROPERTY.name}</h1>
          <p className="text-sm text-muted-foreground">Admin Portal</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div><Label>Email</Label><Input type="email" defaultValue="admin@curtisinnsuites.com" required /></div>
          <div><Label>Password</Label><Input type="password" defaultValue="password" required /></div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">Mock login — no authentication configured</p>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');
      return;
    }
    if (password !== confirm) {
      setError('Οι κωδικοί δεν ταιριάζουν.');
      return;
    }
    setIsLoading(true);
    try {
      await User.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Ο σύνδεσμος είναι άκυρος ή έχει λήξει.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <img src="/logo.png" alt="Jobix" className="h-10 w-auto mb-8" />

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Νέος κωδικός</CardTitle>
          <CardDescription>Ορίστε τον νέο σας κωδικό πρόσβασης.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="text-center space-y-4">
              <p className="text-slate-600">Ο σύνδεσμος δεν είναι έγκυρος.</p>
              <Link to="/forgot-password" className="text-blue-600 font-medium inline-block">
                Ζητήστε νέο σύνδεσμο
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-slate-600">
                Ο κωδικός άλλαξε! Μεταφέρεστε στη σύνδεση...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Νέος κωδικός</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Τουλάχιστον 8 χαρακτήρες"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Επιβεβαίωση κωδικού</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ξαναγράψτε τον κωδικό"
                  required
                  className="mt-1"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={isLoading} className="w-full gradient-bg text-white">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Αλλαγή κωδικού'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

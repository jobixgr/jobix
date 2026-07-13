import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Αν είναι ήδη συνδεδεμένος, προχώρα.
  useEffect(() => {
    User.me()
      .then((u) => {
        navigate(u.organization_id ? '/dashboard' : '/onboarding', { replace: true });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const afterAuth = (user) => {
    const next = searchParams.get('next');
    if (next && next.startsWith('/')) {
      navigate(next, { replace: true });
    } else {
      navigate(user.organization_id ? '/dashboard' : '/onboarding', { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const user =
        mode === 'register'
          ? await User.register(email, password, fullName)
          : await User.login(email, password);
      afterAuth(user);
    } catch (err) {
      setError(err.message || 'Κάτι πήγε στραβά. Δοκιμάστε ξανά.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <span className="text-xl font-bold text-white">J</span>
          </div>
          <span className="text-2xl font-bold text-slate-900">Jobix</span>
        </Link>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {mode === 'register' ? 'Δημιουργία λογαριασμού' : 'Σύνδεση'}
            </CardTitle>
            <CardDescription>
              {mode === 'register'
                ? 'Ξεκινήστε δωρεάν — χωρίς κάρτα.'
                : 'Καλώς ήρθατε ξανά.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Ονοματεπώνυμο</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="π.χ. Γιώργος Παπαδόπουλος"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Κωδικός</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Τουλάχιστον 8 χαρακτήρες"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === 'register' ? 'Εγγραφή' : 'Σύνδεση'}
              </Button>
            </form>

            <div className="text-center mt-6 text-sm text-slate-600">
              {mode === 'register' ? (
                <>
                  Έχετε ήδη λογαριασμό;{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Σύνδεση
                  </button>
                </>
              ) : (
                <>
                  Δεν έχετε λογαριασμό;{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Εγγραφή
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
    // ΠΡΟΤΕΡΑΙΟΤΗΤΑ: αν ο χρήστης δεν έχει οργανισμό, πάει ΠΑΝΤΑ στο onboarding.
    if (!user.organization_id) {
      navigate('/onboarding', { replace: true });
      return;
    }
    // Έχει οργανισμό: ακολούθησε το "next" — εκτός αν είναι ξεπερασμένο
    // (π.χ. ήρθε από το κουμπί εγγραφής με next=/onboarding αλλά έκανε login).
    const next = searchParams.get('next');
    const isStale = !next || !next.startsWith('/') || next.toLowerCase().startsWith('/onboarding');
    navigate(isStale ? '/dashboard' : next, { replace: true });
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

  // ---------- Google Sign-In ----------
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleCredential = async (response) => {
    setError('');
    setIsLoading(true);
    try {
      const user = await User.loginWithGoogle(response.credential);
      afterAuth(user);
    } catch (err) {
      setError(err.message || 'Η σύνδεση με Google απέτυχε.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!googleClientId) return; // δεν έχει ρυθμιστεί ακόμα — κρύβουμε το κουμπί
    const scriptId = 'google-identity-services';
    const init = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      });
      const btn = document.getElementById('google-signin-button');
      if (btn) {
        btn.innerHTML = '';
        window.google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          locale: 'el',
        });
      }
    };
    if (document.getElementById(scriptId)) {
      init();
    } else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.id = scriptId;
      s.onload = init;
      document.body.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, googleClientId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center mb-8">
          <img src="/logo.png" alt="Jobix" className="h-10 w-auto" />
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
            {googleClientId && (
              <div className="mb-5">
                <div id="google-signin-button" className="flex justify-center" />
                <div className="flex items-center gap-3 my-5">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-xs text-slate-400">ή με email</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>
              </div>
            )}
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Κωδικός</Label>
                  {mode === 'login' && (
                    <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                      Ξέχασα τον κωδικό;
                    </Link>
                  )}
                </div>
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

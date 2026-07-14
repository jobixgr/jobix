import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Ο σύνδεσμος δεν είναι έγκυρος.');
      return;
    }
    User.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Το email σας επιβεβαιώθηκε!');
      })
      .catch((e) => {
        setStatus('error');
        setMessage(e.message || 'Ο σύνδεσμος είναι άκυρος ή έχει ήδη χρησιμοποιηθεί.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
          <span className="text-white font-bold text-lg">J</span>
        </div>
        <span className="text-2xl font-bold text-slate-900">Jobix</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Επιβεβαίωση Email</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 py-6">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto animate-spin" />
              <p className="text-slate-600">Επιβεβαίωση σε εξέλιξη...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-slate-700 font-medium">{message}</p>
              <Link to="/dashboard" className="text-blue-600 font-medium inline-block">
                Μετάβαση στο Dashboard
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
              <p className="text-slate-700">{message}</p>
              <Link to="/dashboard" className="text-blue-600 font-medium inline-block">
                Επιστροφή στην εφαρμογή
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { viewCareOffer, acceptCareOffer } from '@/api/functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck, CheckCircle2, Calendar, Phone, Mail,
  AlertCircle, Loader2, PartyPopper,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

export default function PublicCareOffer() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) { setError('Λείπει ο σύνδεσμος.'); setIsLoading(false); return; }
    let cancelled = false;
    viewCareOffer(token)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (d.contract?.status === 'active') setAccepted(true);
      })
      .catch((e) => !cancelled && setError(e.message || 'Ο σύνδεσμος δεν είναι έγκυρος.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      await acceptCareOffer(token);
      setAccepted(true);
    } catch (e) {
      // Αν ήταν ήδη ενεργό, δείξε επιτυχία αντί για σφάλμα (idempotent UX).
      if (String(e.message || '').includes('ήδη ενεργό')) setAccepted(true);
      else setError(e.message || 'Η αποδοχή απέτυχε. Δοκιμάστε ξανά.');
    } finally {
      setAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="font-medium text-slate-800">Ο σύνδεσμος δεν είναι έγκυρος</p>
            <p className="text-sm text-slate-500 mt-1">{error}</p>
            <p className="text-sm text-slate-500 mt-3">
              Επικοινωνήστε με τον τεχνικό σας για νέο σύνδεσμο.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contract, client, organization } = data || {};
  const perYear = contract?.duration_months
    ? Math.round((contract.visits_total / contract.duration_months) * 12 * 10) / 10
    : contract?.visits_total;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-md mx-auto p-4 py-8 space-y-4">

        {/* Ο τεχνικός */}
        <div className="text-center">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="h-12 mx-auto mb-2 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-2">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
          )}
          <p className="font-semibold text-slate-800">{organization?.name || 'Ο τεχνικός σας'}</p>
          {client?.name && (
            <p className="text-sm text-slate-500 mt-1">Πρόταση για: {client.name}</p>
          )}
        </div>

        {accepted ? (
          /* ---------- ΜΕΤΑ ΤΗΝ ΑΠΟΔΟΧΗ ---------- */
          <Card className="border-emerald-200">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <PartyPopper className="w-8 h-8 text-emerald-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Το πρόγραμμά σας είναι ενεργό!</h1>
              <p className="text-slate-600 mt-2 text-sm max-w-xs mx-auto">
                Ο τεχνικός σας θα επικοινωνήσει για να κλείσετε την πρώτη επίσκεψη.
              </p>

              <div className="mt-6 bg-slate-50 rounded-lg p-4 text-left">
                <p className="font-medium text-slate-800">{contract.plan_name}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {contract.visits_total} {contract.visits_total === 1 ? 'επίσκεψη' : 'επισκέψεις'} ·{' '}
                  {contract.duration_months} μήνες
                </p>
                {contract.end_date && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    Ισχύει έως {format(new Date(contract.end_date), 'dd MMMM yyyy', { locale: el })}
                  </p>
                )}
              </div>

              {(organization?.phone || organization?.email) && (
                <div className="mt-4 flex flex-col gap-2">
                  {organization.phone && (
                    <a href={`tel:${organization.phone}`} className="flex items-center justify-center gap-2 text-sm text-blue-600">
                      <Phone className="w-4 h-4" /> {organization.phone}
                    </a>
                  )}
                  {organization.email && (
                    <a href={`mailto:${organization.email}`} className="flex items-center justify-center gap-2 text-sm text-blue-600">
                      <Mail className="w-4 h-4" /> {organization.email}
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* ---------- Η ΠΡΟΣΦΟΡΑ ---------- */
          <>
            <Card className="overflow-hidden border-blue-200">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 text-center">
                <p className="text-blue-100 text-sm font-medium">Πρόγραμμα Φροντίδας</p>
                <h1 className="text-xl font-bold mt-1">{contract.plan_name}</h1>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    €{Number(contract.price || 0).toLocaleString('el-GR')}
                  </span>
                  <span className="text-blue-100 text-sm ml-1">
                    / {contract.duration_months} μήνες
                  </span>
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {contract.visits_total}{' '}
                      {contract.visits_total === 1 ? 'προγραμματισμένη επίσκεψη' : 'προγραμματισμένες επισκέψεις'}
                    </p>
                    {perYear && contract.duration_months !== 12 && (
                      <p className="text-xs text-slate-500">≈ {perYear} τον χρόνο</p>
                    )}
                  </div>
                </div>

                {(contract.benefits || []).length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    {contract.benefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-slate-700">{b}</span>
                      </div>
                    ))}
                  </div>
                )}

                {contract.start_date && (
                  <p className="text-xs text-slate-500 pt-2 border-t">
                    Έναρξη: {format(new Date(contract.start_date), 'dd MMMM yyyy', { locale: el })}
                  </p>
                )}
              </CardContent>
            </Card>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full h-12 text-base gradient-bg text-white"
            >
              {accepting ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Γίνεται αποδοχή...</>
              ) : (
                <>Αποδοχή Προγράμματος</>
              )}
            </Button>

            <p className="text-xs text-center text-slate-500 px-4">
              Η πληρωμή γίνεται απευθείας με τον τεχνικό σας.
              Πατώντας «Αποδοχή» επιβεβαιώνετε το πρόγραμμα συντήρησης.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

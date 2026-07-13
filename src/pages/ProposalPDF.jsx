// Δημόσια σελίδα προβολής προσφοράς (ο σύνδεσμος που στέλνεται στον πελάτη).
// Στο Base44 export αυτή η σελίδα έλειπε εντελώς, παρόλο που η εφαρμογή
// δημιουργούσε συνδέσμους προς /proposalpdf?token=... — τώρα υπάρχει.

import React, { useState, useEffect, useMemo } from 'react';
import { viewPublicProposal, handleProposalResponse } from '@/api/functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Printer } from 'lucide-react';

const fmt = (n) => `€${(Number(n) || 0).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProposalPDF() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Ο σύνδεσμος δεν είναι έγκυρος.');
      setIsLoading(false);
      return;
    }
    viewPublicProposal(token)
      .then(setData)
      .catch((e) => setError(e.message || 'Η προσφορά δεν βρέθηκε.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  const totals = useMemo(() => {
    const result = { subtotal: 0, vat_amount: 0, total: 0, optional_total: 0 };
    for (const item of data?.items || []) {
      const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
      if (item.is_optional) {
        result.optional_total += lineTotal * (1 + (item.vat_rate || 0) / 100);
      } else {
        result.subtotal += lineTotal;
        result.vat_amount += (lineTotal * (item.vat_rate || 0)) / 100;
      }
    }
    result.total = result.subtotal + result.vat_amount;
    return result;
  }, [data]);

  const respond = async (response) => {
    setIsResponding(true);
    try {
      const result = await handleProposalResponse(token, response);
      setData((d) => ({ ...d, proposal: { ...d.proposal, status: result.status } }));
    } catch (e) {
      alert(e.message || 'Κάτι πήγε στραβά.');
    } finally {
      setIsResponding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-slate-600 text-center">{error || 'Η προσφορά δεν βρέθηκε.'}</p>
      </div>
    );
  }

  const { proposal, items, client, organization } = data;
  const answered = proposal.status === 'accepted' || proposal.status === 'rejected';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto">
        {/* Ενέργειες (κρύβονται στην εκτύπωση) */}
        <div className="flex justify-end mb-4 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Εκτύπωση / PDF
          </Button>
        </div>

        <Card className="bg-white shadow-lg print:shadow-none print:border-0">
          <CardContent className="p-8">
            {/* Κεφαλίδα */}
            <div className="flex justify-between items-start pb-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{organization?.name}</h2>
                {organization?.address && <p className="text-sm text-slate-500">{organization.address}</p>}
                {organization?.phone && <p className="text-sm text-slate-500">Τηλ: {organization.phone}</p>}
                {organization?.email && <p className="text-sm text-slate-500">{organization.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-slate-900">Προσφορά #{proposal.number}</p>
                {proposal.created_date && (
                  <p className="text-sm text-slate-500">
                    {new Date(proposal.created_date).toLocaleDateString('el-GR')}
                  </p>
                )}
                {proposal.valid_until && (
                  <p className="text-sm text-slate-500">
                    Ισχύει έως: {new Date(proposal.valid_until).toLocaleDateString('el-GR')}
                  </p>
                )}
              </div>
            </div>

            {/* Πελάτης & τίτλος */}
            <div className="py-6">
              {client?.name && <p className="text-sm text-slate-500">Προς: <span className="font-medium text-slate-800">{client.name}</span></p>}
              {proposal.title && <h1 className="text-xl font-bold text-slate-900 mt-2">{proposal.title}</h1>}
              {proposal.description && <p className="text-slate-600 mt-2 whitespace-pre-wrap">{proposal.description}</p>}
            </div>

            {/* Πίνακας εργασιών/υλικών */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-2 pr-2 font-medium">Περιγραφή</th>
                  <th className="py-2 px-2 font-medium text-right">Ποσ.</th>
                  <th className="py-2 px-2 font-medium text-right">Τιμή</th>
                  <th className="py-2 px-2 font-medium text-right">ΦΠΑ</th>
                  <th className="py-2 pl-2 font-medium text-right">Σύνολο</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-2 text-slate-800">
                      {item.description}
                      {item.is_optional && (
                        <Badge variant="outline" className="ml-2 text-xs">Προαιρετικό</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{fmt(item.unit_price)}</td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{item.vat_rate || 0}%</td>
                    <td className="py-2.5 pl-2 text-right font-medium text-slate-800">
                      {fmt((item.quantity || 0) * (item.unit_price || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Σύνολα */}
            <div className="flex justify-end mt-6">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Υποσύνολο</span><span>{fmt(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ΦΠΑ</span><span>{fmt(totals.vat_amount)}</span>
                </div>
                {totals.optional_total > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Προαιρετικά (με ΦΠΑ)</span><span>{fmt(totals.optional_total)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-slate-900 border-t border-slate-300 pt-2">
                  <span>Σύνολο</span><span>{fmt(totals.total)}</span>
                </div>
              </div>
            </div>

            {proposal.notes && (
              <p className="text-xs text-slate-500 mt-8 whitespace-pre-wrap">{proposal.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* Αποδοχή / Απόρριψη (κρύβεται στην εκτύπωση) */}
        <div className="mt-6 print:hidden">
          {answered ? (
            <div
              className={`flex items-center justify-center gap-2 p-4 rounded-xl ${
                proposal.status === 'accepted'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {proposal.status === 'accepted' ? (
                <><CheckCircle2 className="w-5 h-5" /> Η προσφορά έχει γίνει αποδεκτή. Ευχαριστούμε!</>
              ) : (
                <><XCircle className="w-5 h-5" /> Η προσφορά έχει απορριφθεί.</>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => respond('accepted')}
                disabled={isResponding}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
              >
                {isResponding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Αποδοχή προσφοράς
              </Button>
              <Button
                variant="outline"
                onClick={() => respond('rejected')}
                disabled={isResponding}
                className="text-red-600 border-red-200 hover:bg-red-50 px-8"
              >
                <XCircle className="w-4 h-4 mr-2" /> Απόρριψη
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8 print:hidden">
          Δημιουργήθηκε με Jobix
        </p>
      </div>
    </div>
  );
}

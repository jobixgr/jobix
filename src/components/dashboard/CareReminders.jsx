import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShieldCheck, AlertTriangle, ArrowRight, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

/**
 * Υπενθύμιση στο Dashboard: ποιες επισκέψεις συντήρησης χρειάζονται δράση.
 * Εμφανίζεται ΜΟΝΟ αν υπάρχει κάτι εκκρεμές — αλλιώς δεν γεμίζει την οθόνη.
 */
export default function CareReminders({ visits = [], clients = [] }) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in30ISO = in30.toISOString().slice(0, 10);

  const pending = visits.filter((v) => v.status === 'pending' && v.due_date);
  const overdue = pending.filter((v) => v.due_date < todayISO);
  const soon = pending.filter((v) => v.due_date >= todayISO && v.due_date <= in30ISO);

  const items = [...overdue, ...soon]
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 4);

  if (items.length === 0) return null;

  const clientName = (id) => clients.find((c) => c.id === id)?.name || '';

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/60 to-white">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
          Επισκέψεις συντήρησης
          {overdue.length > 0 && (
            <Badge className="bg-red-100 text-red-700 gap-1">
              <AlertTriangle className="w-3 h-3" />
              {overdue.length} εκπρόθεσμες
            </Badge>
          )}
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to={createPageUrl('Care')}>
            Όλες <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((v) => {
          const isOverdue = v.due_date < todayISO;
          return (
            <div
              key={v.id}
              className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border ${
                isOverdue ? 'border-red-200 bg-red-50/50' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{v.title}</p>
                <p className="text-xs text-slate-500">
                  {clientName(v.client_id)} ·{' '}
                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                    {format(new Date(v.due_date), 'dd MMM', { locale: el })}
                  </span>
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to={createPageUrl('Care')}>
                  <CalendarPlus className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

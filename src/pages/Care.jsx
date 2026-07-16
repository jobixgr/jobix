import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { CarePlan, CareContract, CareVisit, Client, User } from '@/api/entities';
import CarePlanDialog from '@/components/care/CarePlanDialog';
import CareContractDialog from '@/components/care/CareContractDialog';
import CareVisitDialog from '@/components/care/CareVisitDialog';
import {
  Plus, ShieldCheck, Calendar, Users, Euro, TrendingUp,
  Pencil, Clock, CheckCircle2, CalendarPlus, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const statusInfo = {
  draft:     { label: 'Πρόχειρο',   cls: 'bg-slate-100 text-slate-700' },
  sent:      { label: 'Στάλθηκε',   cls: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Ενεργό',     cls: 'bg-emerald-100 text-emerald-700' },
  expired:   { label: 'Έληξε',      cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Ακυρώθηκε',  cls: 'bg-red-100 text-red-700' },
};

export default function Care() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [visits, setVisits] = useState([]);
  const [clients, setClients] = useState([]);
  const [planDialog, setPlanDialog] = useState({ open: false, plan: null });
  const [contractDialog, setContractDialog] = useState({ open: false });
  const [visitDialog, setVisitDialog] = useState({ open: false, visit: null });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      if (!user?.organization_id) return;
      const org = { organization_id: user.organization_id };
      const [p, c, v, cl] = await Promise.all([
        CarePlan.filter(org, '-created_date'),
        CareContract.filter(org, '-created_date'),
        CareVisit.filter(org, 'due_date'),
        Client.filter(org),
      ]);
      setPlans(p || []);
      setContracts(c || []);
      setVisits(v || []);
      setClients(cl || []);
    } catch (e) {
      toast({ title: 'Σφάλμα', description: 'Αποτυχία φόρτωσης.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const clientName = (id) => clients.find((c) => c.id === id)?.name || 'Άγνωστος πελάτης';

  // --- Στατιστικά εσόδων ---
  const activeContracts = contracts.filter((c) => c.status === 'active');
  const recurringRevenue = activeContracts.reduce((s, c) => s + (Number(c.price) || 0), 0);
  // ΥΠΕΝΘΥΜΙΣΕΙΣ: επισκέψεις που χρειάζονται δράση.
  // «Ληξιπρόθεσμη» = πέρασε η ημερομηνία και δεν προγραμματίστηκε ποτέ.
  // «Πλησιάζει»    = μέσα στις επόμενες 30 μέρες.
  const todayISO = new Date().toISOString().slice(0, 10);
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in30ISO = in30.toISOString().slice(0, 10);

  const openVisits = visits.filter((v) => v.status !== 'completed');
  const overdueVisits = openVisits.filter((v) => v.due_date && v.due_date < todayISO && v.status === 'pending');
  const dueSoonVisits = openVisits.filter(
    (v) => v.due_date && v.due_date >= todayISO && v.due_date <= in30ISO && v.status === 'pending'
  );
  const actionNeeded = overdueVisits.length + dueSoonVisits.length;

  const sortedOpenVisits = [...openVisits].sort((a, b) =>
    String(a.due_date).localeCompare(String(b.due_date))
  );

  // Συμβόλαια που λήγουν στους επόμενους 2 μήνες
  const soon = new Date(); soon.setMonth(soon.getMonth() + 2);
  const expiringSoon = activeContracts.filter(
    (c) => c.end_date && new Date(c.end_date) <= soon
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Jobix Care
          </h1>
          <p className="text-slate-500 mt-1">
            Συμβόλαια συντήρησης — σταθερό έσοδο από τους πελάτες σου.
          </p>
        </div>
        <Button
          onClick={() => setContractDialog({ open: true })}
          className="gradient-bg text-white"
          disabled={plans.length === 0 || clients.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Νέο Συμβόλαιο
        </Button>
      </div>

      {/* Στατιστικά */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Ενεργά συμβόλαια</p>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-1">{activeContracts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Ετήσιο έσοδο</p>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              €{recurringRevenue.toLocaleString('el-GR')}
            </p>
          </CardContent>
        </Card>
        <Card className={actionNeeded > 0 ? 'border-purple-300 bg-purple-50/50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Χρειάζονται δράση</p>
              <Calendar className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-700 mt-1">{actionNeeded}</p>
            {overdueVisits.length > 0 && (
              <p className="text-xs text-red-600 mt-0.5">{overdueVisits.length} εκπρόθεσμες</p>
            )}
          </CardContent>
        </Card>
        <Card className={expiringSoon.length > 0 ? 'border-amber-300 bg-amber-50/50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Λήγουν σύντομα</p>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{expiringSoon.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="contracts">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="contracts" className="flex-1 md:flex-initial">
            Συμβόλαια ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="plans" className="flex-1 md:flex-initial">
            Πακέτα ({plans.length})
          </TabsTrigger>
          <TabsTrigger value="visits" className="flex-1 md:flex-initial">
            Επισκέψεις{actionNeeded > 0 ? ` (${actionNeeded})` : ''}
          </TabsTrigger>
        </TabsList>

        {/* ---- ΣΥΜΒΟΛΑΙΑ ---- */}
        <TabsContent value="contracts" className="mt-4">
          {contracts.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Κανένα συμβόλαιο ακόμα</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {plans.length === 0
                  ? 'Φτιάξε πρώτα ένα πακέτο συντήρησης, μετά ανάθεσέ το σε πελάτες.'
                  : 'Ανάθεσε ένα πακέτο σε πελάτη για να ξεκινήσεις.'}
              </p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => {
                const cv = visits.filter((v) => v.contract_id === c.id);
                const done = cv.filter((v) => v.status === 'completed').length;
                const st = statusInfo[c.status] || statusInfo.draft;
                return (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900">{c.plan_name}</h3>
                            <Badge className={st.cls}>{st.label}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">{clientName(c.client_id)}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Euro className="w-3 h-3" />€{Number(c.price || 0).toLocaleString('el-GR')}
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {done}/{c.visits_total || cv.length} επισκέψεις
                            </span>
                            {c.end_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                έως {format(new Date(c.end_date), 'dd/MM/yy', { locale: el })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ---- ΠΑΚΕΤΑ ---- */}
        <TabsContent value="plans" className="mt-4 space-y-3">
          <Button variant="outline" onClick={() => setPlanDialog({ open: true, plan: null })} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Νέο Πακέτο
          </Button>

          {plans.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <p className="text-slate-600 font-medium">Κανένα πακέτο ακόμα</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Π.χ. «Ετήσιο Πρόγραμμα Φροντίδας 89€ — δύο service και προτεραιότητα σε βλάβες».
              </p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900">{p.name}</h3>
                        <p className="text-2xl font-bold text-blue-600 mt-1">
                          €{Number(p.price || 0).toLocaleString('el-GR')}
                          <span className="text-sm font-normal text-slate-500">
                            {' '}/ {p.duration_months} μήνες
                          </span>
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setPlanDialog({ open: true, plan: p })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      {p.visits_count} {p.visits_count === 1 ? 'επίσκεψη' : 'επισκέψεις'}
                    </p>
                    {(p.benefits || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {p.benefits.map((b, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---- ΕΠΙΣΚΕΨΕΙΣ ---- */}
        <TabsContent value="visits" className="mt-4">
          {sortedOpenVisits.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Καμία εκκρεμής επίσκεψη</p>
              <p className="text-sm text-slate-500 mt-1">
                Οι επισκέψεις δημιουργούνται αυτόματα με την ενεργοποίηση συμβολαίου.
              </p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {sortedOpenVisits.map((v) => {
                const isOverdue = v.due_date && v.due_date < todayISO && v.status === 'pending';
                const isSoon = v.due_date && v.due_date >= todayISO && v.due_date <= in30ISO && v.status === 'pending';
                const isScheduled = v.status === 'scheduled';
                return (
                  <Card
                    key={v.id}
                    className={
                      isOverdue ? 'border-red-200 bg-red-50/40'
                      : isScheduled ? 'border-emerald-200 bg-emerald-50/30'
                      : isSoon ? 'border-amber-200 bg-amber-50/30' : ''
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-900">{v.title}</p>
                            {isOverdue && (
                              <Badge className="bg-red-100 text-red-700 gap-1">
                                <AlertTriangle className="w-3 h-3" /> Εκπρόθεσμη
                              </Badge>
                            )}
                            {isScheduled && (
                              <Badge className="bg-emerald-100 text-emerald-700">Στην Ατζέντα</Badge>
                            )}
                            {isSoon && !isScheduled && (
                              <Badge className="bg-amber-100 text-amber-700">Πλησιάζει</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">{clientName(v.client_id)}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {isScheduled && v.scheduled_date
                              ? `Ραντεβού: ${format(new Date(v.scheduled_date), 'dd MMM yyyy, HH:mm', { locale: el })}`
                              : v.due_date
                                ? `Προβλέπεται: ${format(new Date(v.due_date), 'dd MMM yyyy', { locale: el })}`
                                : '—'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isScheduled ? 'outline' : 'default'}
                          className={isScheduled ? '' : 'gradient-bg text-white'}
                          onClick={() => setVisitDialog({ open: true, visit: v })}
                        >
                          <CalendarPlus className="w-4 h-4 mr-2" />
                          {isScheduled ? 'Άνοιγμα' : 'Προγραμματισμός'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CarePlanDialog
        open={planDialog.open}
        onOpenChange={(o) => setPlanDialog({ open: o, plan: o ? planDialog.plan : null })}
        existingPlan={planDialog.plan}
        onSaved={load}
      />
      <CareVisitDialog
        open={visitDialog.open}
        onOpenChange={(o) => setVisitDialog({ open: o, visit: o ? visitDialog.visit : null })}
        visit={visitDialog.visit}
        clientName={visitDialog.visit ? clientName(visitDialog.visit.client_id) : ''}
        onSaved={load}
      />
      <CareContractDialog
        open={contractDialog.open}
        onOpenChange={(o) => setContractDialog({ open: o })}
        plans={plans}
        clients={clients}
        onSaved={load}
      />
    </div>
  );
}

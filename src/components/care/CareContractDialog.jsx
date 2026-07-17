import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { CareContract, User } from '@/api/entities';
import { activateCareContract } from '@/api/functions';
import { Loader2, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

export default function CareContractDialog({ open, onOpenChange, plans, clients, onSaved }) {
  const { toast } = useToast();
  const [planId, setPlanId] = useState('');
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPlanId('');
      setClientId('');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [open]);

  const plan = plans?.find((p) => p.id === planId);

  // Προεπισκόπηση των ημερομηνιών — ίδια λογική με την SQL function,
  // ώστε ο τεχνίτης να βλέπει ΑΚΡΙΒΩΣ τι θα δημιουργηθεί πριν πατήσει.
  const previewVisits = React.useMemo(() => {
    if (!plan || !startDate) return [];
    const months = Number(plan.duration_months) || 12;
    const count = Number(plan.visits_count) || 1;
    const interval = months / count;
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return [];
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + Math.round(i * interval * 30.44));
      return d;
    });
  }, [plan, startDate]);

  const handleSave = async (activateNow) => {
    if (!planId || !clientId) {
      toast({
        title: 'Λείπουν στοιχεία',
        description: 'Επιλέξτε πακέτο και πελάτη.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const user = await User.me();
      // Κρατάμε snapshot των στοιχείων του πακέτου: αν αργότερα αλλάξει η τιμή
      // του πακέτου, το υπάρχον συμβόλαιο ΔΕΝ πρέπει να αλλάξει αναδρομικά.
      const created = await CareContract.create({
        organization_id: user.organization_id,
        plan_id: plan.id,
        client_id: clientId,
        plan_name: plan.name,
        price: Number(plan.price) || 0,
        currency: plan.currency || 'EUR',
        duration_months: Number(plan.duration_months) || 12,
        visits_total: Number(plan.visits_count) || 1,
        visits_completed: 0,
        benefits: plan.benefits || [],
        start_date: startDate,
        status: 'draft',
        payment_status: 'unpaid',
      });

      if (activateNow) {
        // Δημιουργεί ΑΤΟΜΙΚΑ όλες τις επισκέψεις στον server.
        const res = await activateCareContract({ contractId: created.id });
        toast({
          title: 'Το συμβόλαιο ενεργοποιήθηκε!',
          description: `Δημιουργήθηκαν ${res.visits_created} επισκέψεις.`,
        });
      } else {
        toast({ title: 'Αποθηκεύτηκε', description: 'Το συμβόλαιο είναι πρόχειρο.' });
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Σφάλμα',
        description: e.message || 'Η αποθήκευση απέτυχε.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Νέο Συμβόλαιο Συντήρησης</DialogTitle>
          <DialogDescription>
            Ανάθεσε ένα πακέτο σε πελάτη. Οι επισκέψεις προγραμματίζονται αυτόματα.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Πακέτο *</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε πακέτο" /></SelectTrigger>
              <SelectContent>
                {(plans || []).filter((p) => p.is_active !== false).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — €{Number(p.price || 0).toLocaleString('el-GR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Πελάτης *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε πελάτη" /></SelectTrigger>
              <SelectContent>
                {(clients || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-start">Ημερομηνία έναρξης</Label>
            <Input
              id="cc-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Προεπισκόπηση: ο τεχνίτης βλέπει τι ΑΚΡΙΒΩΣ θα δημιουργηθεί */}
          {previewVisits.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-900 flex items-center gap-1.5 mb-2">
                <CalendarCheck className="w-4 h-4" />
                Θα προγραμματιστούν {previewVisits.length}{' '}
                {previewVisits.length === 1 ? 'επίσκεψη' : 'επισκέψεις'}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previewVisits.map((d, i) => (
                  <span key={i} className="text-xs bg-white text-blue-700 px-2 py-1 rounded-md border border-blue-200">
                    {format(d, 'dd MMM yyyy', { locale: el })}
                  </span>
                ))}
              </div>
              {plan && (
                <p className="text-xs text-blue-700 mt-2">
                  Έσοδο: <strong>€{Number(plan.price || 0).toLocaleString('el-GR')}</strong>
                  {' '}για {plan.duration_months} μήνες
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Άκυρο
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            Πρόχειρο
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isSaving} className="gradient-bg text-white">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Ενεργοποίηση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

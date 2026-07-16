import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { CarePlan, User } from '@/api/entities';
import { Loader2, Plus, X } from 'lucide-react';

const EMPTY = {
  name: '',
  description: '',
  duration_months: 12,
  visits_count: 2,
  price: '',
  benefits: [],
  is_active: true,
};

export default function CarePlanDialog({ open, onOpenChange, existingPlan, onSaved }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(EMPTY);
  const [benefitInput, setBenefitInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPlan(existingPlan ? { ...EMPTY, ...existingPlan } : EMPTY);
      setBenefitInput('');
    }
  }, [open, existingPlan]);

  const set = (k, v) => setPlan((p) => ({ ...p, [k]: v }));

  const addBenefit = () => {
    const t = benefitInput.trim();
    if (!t) return;
    set('benefits', [...(plan.benefits || []), t]);
    setBenefitInput('');
  };

  const removeBenefit = (i) =>
    set('benefits', (plan.benefits || []).filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!plan.name.trim()) {
      toast({ title: 'Λείπει το όνομα', description: 'Δώστε ένα όνομα στο πακέτο.', variant: 'destructive' });
      return;
    }
    const price = Number(plan.price);
    if (!price || price <= 0) {
      toast({ title: 'Μη έγκυρη τιμή', description: 'Η τιμή πρέπει να είναι μεγαλύτερη από 0.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const user = await User.me();
      const payload = {
        organization_id: user.organization_id,
        name: plan.name.trim(),
        description: plan.description?.trim() || '',
        duration_months: Number(plan.duration_months) || 12,
        visits_count: Number(plan.visits_count) || 1,
        price,
        currency: 'EUR',
        benefits: plan.benefits || [],
        is_active: plan.is_active !== false,
      };
      if (existingPlan?.id) await CarePlan.update(existingPlan.id, payload);
      else await CarePlan.create(payload);
      toast({ title: 'Αποθηκεύτηκε', description: `Το πακέτο "${payload.name}" είναι έτοιμο.` });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Σφάλμα', description: e.message || 'Η αποθήκευση απέτυχε.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Προεπισκόπηση: πόσο συχνά θα γίνονται οι επισκέψεις
  const months = Number(plan.duration_months) || 12;
  const visits = Number(plan.visits_count) || 1;
  const everyMonths = visits > 0 ? (months / visits).toFixed(1).replace('.0', '') : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingPlan ? 'Επεξεργασία Πακέτου' : 'Νέο Πακέτο Συντήρησης'}</DialogTitle>
          <DialogDescription>
            Ορίστε το μία φορά και προσφέρετέ το σε όσους πελάτες θέλετε.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-name">Όνομα πακέτου *</Label>
            <Input
              id="cp-name"
              value={plan.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="π.χ. Ετήσιο Πρόγραμμα Φροντίδας Κλιματιστικού"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cp-price">Τιμή (€) *</Label>
              <Input
                id="cp-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={plan.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="89"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-months">Διάρκεια (μήνες)</Label>
              <Input
                id="cp-months"
                type="number"
                inputMode="numeric"
                min="1"
                value={plan.duration_months}
                onChange={(e) => set('duration_months', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp-visits">Επισκέψεις</Label>
              <Input
                id="cp-visits"
                type="number"
                inputMode="numeric"
                min="1"
                value={plan.visits_count}
                onChange={(e) => set('visits_count', e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-slate-50 rounded-md p-2">
            📅 {visits} {visits === 1 ? 'επίσκεψη' : 'επισκέψεις'} σε {months} μήνες
            {visits > 1 && ` — μία κάθε ~${everyMonths} μήνες`}
          </p>

          <div className="space-y-2">
            <Label htmlFor="cp-desc">Περιγραφή</Label>
            <Textarea
              id="cp-desc"
              value={plan.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Τι ακριβώς περιλαμβάνει το πρόγραμμα..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Παροχές</Label>
            <div className="flex gap-2">
              <Input
                value={benefitInput}
                onChange={(e) => setBenefitInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBenefit(); } }}
                placeholder="π.χ. Προτεραιότητα σε βλάβες"
              />
              <Button type="button" variant="outline" onClick={addBenefit} className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {(plan.benefits || []).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {plan.benefits.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-2 py-1 rounded-full">
                    {b}
                    <button type="button" onClick={() => removeBenefit(i)} className="hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Άκυρο
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-bg text-white">
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Αποθήκευση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

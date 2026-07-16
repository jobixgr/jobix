import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { scheduleCareVisit, completeCareVisit } from '@/api/functions';
import { Loader2, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const QUICK_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '16:00', '18:00'];

export default function CareVisitDialog({ open, onOpenChange, visit, clientName, onSaved }) {
  const { toast } = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && visit) {
      // Προεπιλογή: η ημερομηνία που «πρέπει» να γίνει, ή η ήδη προγραμματισμένη.
      const src = visit.scheduled_date || visit.due_date;
      const d = src ? new Date(src) : new Date();
      setDate(format(d, 'yyyy-MM-dd'));
      setTime(visit.scheduled_date ? format(d, 'HH:mm') : '09:00');
      setNotes(visit.notes || '');
    }
  }, [open, visit]);

  const handleSchedule = async () => {
    if (!date) {
      toast({ title: 'Λείπει η ημερομηνία', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const iso = new Date(`${date}T${time || '09:00'}:00`).toISOString();
      const res = await scheduleCareVisit({ visitId: visit.id, appointment_date: iso });
      toast({
        title: res.updated ? 'Το ραντεβού ενημερώθηκε' : 'Μπήκε στην Ατζέντα!',
        description: `${format(new Date(iso), 'dd MMM yyyy, HH:mm', { locale: el })} — ${clientName}`,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Σφάλμα', description: e.message || 'Ο προγραμματισμός απέτυχε.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    setBusy(true);
    try {
      await completeCareVisit({ visitId: visit.id, notes });
      toast({ title: 'Ολοκληρώθηκε!', description: 'Η επίσκεψη καταγράφηκε στο ιστορικό.' });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Σφάλμα', description: e.message || 'Απέτυχε.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (!visit) return null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{visit.title}</DialogTitle>
          <DialogDescription>
            {clientName}
            {visit.due_date && ` · προβλέπεται ${format(new Date(visit.due_date), 'dd MMM yyyy', { locale: el })}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cv-date">Ημερομηνία</Label>
              <Input
                id="cv-date"
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cv-time">Ώρα</Label>
              <Input id="cv-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  time === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cv-notes">Σημειώσεις</Label>
            <Textarea
              id="cv-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Τι έγινε / τι χρειάζεται..."
            />
          </div>
        </div>

        <DialogFooter>
          {visit.status !== 'completed' && (
            <Button variant="outline" onClick={handleComplete} disabled={busy}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Ολοκληρώθηκε
            </Button>
          )}
          <Button onClick={handleSchedule} disabled={busy} className="gradient-bg text-white">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
            {visit.appointment_id ? 'Ενημέρωση ραντεβού' : 'Στην Ατζέντα'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

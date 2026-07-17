import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getCareShareLink } from '@/api/functions';
import { MessageCircle, Phone, Mail, Copy, Check, Loader2 } from 'lucide-react';

/**
 * Αποστολή προγράμματος στον πελάτη.
 * ΓΙΑΤΙ: το σκέτο «αντιγραφή συνδέσμου» ανάγκαζε τον τεχνίτη να ανοίξει άλλη
 * εφαρμογή και να γράψει μήνυμα από το μηδέν — στον δρόμο, από κινητό.
 * Εδώ το μήνυμα είναι έτοιμο και ανοίγει κατευθείαν στη σωστή εφαρμογή.
 */
export default function CareShareDialog({ open, onOpenChange, contract, client, orgName, onSent }) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !contract) return;
    let cancelled = false;
    setLoading(true);
    setUrl('');
    getCareShareLink({ contractId: contract.id })
      .then(({ url: u }) => {
        if (cancelled) return;
        setUrl(u);
        const firstName = (client?.name || '').split(' ')[0] || '';
        setMessage(
          `Γεια σας${firstName ? ` ${firstName}` : ''}, σας στέλνω το πρόγραμμα συντήρησης ` +
          `"${contract.plan_name}" (${Number(contract.price || 0).toLocaleString('el-GR')}€). ` +
          `Μπορείτε να δείτε τι περιλαμβάνει και να το αποδεχτείτε εδώ:\n${u}` +
          (orgName ? `\n\n— ${orgName}` : '')
        );
        onSent?.();
      })
      .catch((e) => {
        if (!cancelled) {
          toast({ title: 'Σφάλμα', description: e.message || 'Αποτυχία.', variant: 'destructive' });
          onOpenChange(false);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract]);

  // Καθαρό τηλέφωνο για τα links (χωρίς κενά/παύλες).
  const rawPhone = (client?.phone || '').replace(/[^\d+]/g, '');
  // Ελληνικά κινητά: το WhatsApp/Viber θέλουν διεθνή μορφή.
  const intlPhone = rawPhone.startsWith('+')
    ? rawPhone.replace('+', '')
    : rawPhone.startsWith('00')
      ? rawPhone.slice(2)
      : rawPhone.length === 10 && rawPhone.startsWith('6')
        ? `30${rawPhone}`
        : rawPhone;

  const openApp = (href) => {
    window.open(href, '_blank', 'noopener');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Αντιγράφηκε!', description: 'Το μήνυμα είναι έτοιμο για επικόλληση.' });
    } catch {
      toast({ title: 'Ο σύνδεσμος', description: url, duration: 15000 });
    }
  };

  const hasPhone = !!intlPhone;
  const hasEmail = !!client?.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Αποστολή στον πελάτη</DialogTitle>
          <DialogDescription>
            {client?.name}
            {client?.phone && ` · ${client.phone}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Δημιουργία συνδέσμου...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-msg">Μήνυμα</Label>
              <Textarea
                id="share-msg"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!hasPhone}
                onClick={() => openApp(`https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`)}
                className="justify-start"
              >
                <MessageCircle className="w-4 h-4 mr-2 text-emerald-600" />
                WhatsApp
              </Button>

              <Button
                variant="outline"
                disabled={!hasPhone}
                onClick={() => openApp(`viber://forward?text=${encodeURIComponent(message)}`)}
                className="justify-start"
              >
                <MessageCircle className="w-4 h-4 mr-2 text-purple-600" />
                Viber
              </Button>

              <Button
                variant="outline"
                disabled={!hasPhone}
                onClick={() => openApp(`sms:${rawPhone}?&body=${encodeURIComponent(message)}`)}
                className="justify-start"
              >
                <Phone className="w-4 h-4 mr-2 text-blue-600" />
                SMS
              </Button>

              <Button
                variant="outline"
                disabled={!hasEmail}
                onClick={() =>
                  openApp(
                    `mailto:${client.email}?subject=${encodeURIComponent(
                      `Πρόγραμμα συντήρησης: ${contract?.plan_name || ''}`
                    )}&body=${encodeURIComponent(message)}`
                  )
                }
                className="justify-start"
              >
                <Mail className="w-4 h-4 mr-2 text-slate-600" />
                Email
              </Button>
            </div>

            {(!hasPhone || !hasEmail) && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-md p-2">
                {!hasPhone && !hasEmail
                  ? 'Ο πελάτης δεν έχει τηλέφωνο ούτε email — πρόσθεσέ τα στην καρτέλα του.'
                  : !hasPhone
                    ? 'Χωρίς τηλέφωνο δεν μπορείς να στείλεις WhatsApp/Viber/SMS.'
                    : 'Ο πελάτης δεν έχει email.'}
              </p>
            )}

            <Button variant="ghost" onClick={handleCopy} className="w-full">
              {copied ? (
                <><Check className="w-4 h-4 mr-2 text-emerald-600" /> Αντιγράφηκε</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" /> Αντιγραφή μηνύματος</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

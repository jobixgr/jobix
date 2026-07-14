import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { Mail, X } from 'lucide-react';

export default function EmailVerificationBanner() {
  const [user, setUser] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    User.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Δείξε το banner μόνο αν ο χρήστης είναι συνδεδεμένος και ΔΕΝ έχει επιβεβαιωμένο email.
  if (!user || user.email_verified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await User.resendVerification();
      setSent(true);
    } catch {
      // σιωπηλά — δεν θέλουμε να μπλοκάρουμε τον χρήστη
    }
    setSending(false);
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-amber-800">
          <Mail className="w-4 h-4 flex-shrink-0" />
          {sent ? (
            <span>Στάλθηκε νέο email επιβεβαίωσης στο <strong>{user.email}</strong>. Ελέγξτε τα εισερχόμενά σας.</span>
          ) : (
            <span>Επιβεβαιώστε το email σας ({user.email}) για πλήρη πρόσβαση.</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!sent && (
            <button
              onClick={handleResend}
              disabled={sending}
              className="text-sm font-medium text-amber-800 underline hover:text-amber-900 disabled:opacity-50"
            >
              {sending ? 'Αποστολή...' : 'Επαναποστολή'}
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

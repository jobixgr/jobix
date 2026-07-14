import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { User as UserModel } from "@/api/entities";
import { KeyRound, Mail, Loader2 } from "lucide-react";

export default function AccountSecurity({ user, onEmailChanged }) {
  const { toast } = useToast();

  // ----- Αλλαγή κωδικού -----
  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast({ title: "Σφάλμα", description: "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Σφάλμα", description: "Οι κωδικοί δεν ταιριάζουν.", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      await UserModel.changePassword(currentPw, newPw);
      toast({ title: "Επιτυχία", description: "Ο κωδικός άλλαξε." });
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setShowPw(false);
    } catch (e) {
      toast({ title: "Σφάλμα", description: e.message || "Η αλλαγή απέτυχε.", variant: "destructive" });
    }
    setSavingPw(false);
  };

  // ----- Αλλαγή email -----
  const [showEmail, setShowEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const handleChangeEmail = async () => {
    if (!newEmail.includes("@")) {
      toast({ title: "Σφάλμα", description: "Μη έγκυρο email.", variant: "destructive" });
      return;
    }
    setSavingEmail(true);
    try {
      const res = await UserModel.changeEmail(newEmail.trim().toLowerCase(), emailPw);
      toast({ title: "Επιτυχία", description: "Το email άλλαξε." });
      setNewEmail(""); setEmailPw(""); setShowEmail(false);
      if (onEmailChanged && res?.user) onEmailChanged(res.user);
    } catch (e) {
      toast({ title: "Σφάλμα", description: e.message || "Η αλλαγή απέτυχε.", variant: "destructive" });
    }
    setSavingEmail(false);
  };

  return (
    <div className="space-y-4">
      {/* Αλλαγή Κωδικού */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4" /> Κωδικός Πρόσβασης
          </CardTitle>
          {!showPw && (
            <Button variant="outline" size="sm" onClick={() => setShowPw(true)}>Αλλαγή</Button>
          )}
        </CardHeader>
        {showPw && (
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="cur-pw">Τρέχων κωδικός</Label>
              <Input id="cur-pw" type="password" value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)} className="mt-1"
                placeholder="Αφήστε κενό αν συνδέεστε μόνο με Google" />
            </div>
            <div>
              <Label htmlFor="new-pw">Νέος κωδικός</Label>
              <Input id="new-pw" type="password" value={newPw}
                onChange={(e) => setNewPw(e.target.value)} className="mt-1"
                placeholder="Τουλάχιστον 8 χαρακτήρες" />
            </div>
            <div>
              <Label htmlFor="conf-pw">Επιβεβαίωση νέου κωδικού</Label>
              <Input id="conf-pw" type="password" value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => { setShowPw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} disabled={savingPw}>
                Άκυρο
              </Button>
              <Button onClick={handleChangePassword} disabled={savingPw} className="gradient-bg text-white">
                {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : "Αποθήκευση"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Αλλαγή Email */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4" /> Διεύθυνση Email
          </CardTitle>
          {!showEmail && (
            <Button variant="outline" size="sm" onClick={() => setShowEmail(true)}>Αλλαγή</Button>
          )}
        </CardHeader>
        {showEmail && (
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="new-email">Νέο email</Label>
              <Input id="new-email" type="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} className="mt-1"
                placeholder="you@example.com" />
            </div>
            <div>
              <Label htmlFor="email-pw">Κωδικός (για επιβεβαίωση)</Label>
              <Input id="email-pw" type="password" value={emailPw}
                onChange={(e) => setEmailPw(e.target.value)} className="mt-1"
                placeholder="Αφήστε κενό αν συνδέεστε μόνο με Google" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => { setShowEmail(false); setNewEmail(""); setEmailPw(""); }} disabled={savingEmail}>
                Άκυρο
              </Button>
              <Button onClick={handleChangeEmail} disabled={savingEmail} className="gradient-bg text-white">
                {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Αποθήκευση"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

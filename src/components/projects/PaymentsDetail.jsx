
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Payment } from '@/api/entities';
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { 
  Plus, 
  Euro, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar,
  CreditCard,
  Banknote,
  Wallet,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusColors = {
  pending: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
  paid: { bg: "bg-emerald-100", text: "emerald-800", border: "border-emerald-200" },
  overdue: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" }
};

const statusLabels = {
  pending: "Εκκρεμής",
  paid: "Πληρωμένη", 
  overdue: "Εκπρόθεσμη"
};

const statusIcons = {
  pending: Clock,
  paid: CheckCircle2,
  overdue: AlertTriangle
};

const methodLabels = {
  cash: "Μετρητά",
  bank_transfer: "Τραπεζική Μεταφορά", 
  card: "Κάρτα",
  check: "Επιταγή"
};

const methodIcons = {
  cash: Banknote,
  bank_transfer: CreditCard,
  card: CreditCard,
  check: Wallet
};

function NewPaymentDialog({ isOpen, onClose, project, onPaymentAdded }) {
  const [newPayment, setNewPayment] = useState({
    title: "",
    amount: "",
    due_date: new Date().toISOString().split('T')[0],
    method: "bank_transfer",
    notes: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!newPayment.title || !newPayment.amount) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε τίτλο και ποσό.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await Payment.create({
        organization_id: project.organization_id,
        project_id: project.id,
        client_id: project.client_id,
        title: newPayment.title,
        amount: parseFloat(newPayment.amount),
        due_date: newPayment.due_date,
        method: newPayment.method,
        notes: newPayment.notes,
        status: 'pending'
      });

      toast({ title: "Επιτυχία!", description: "Η νέα πληρωμή καταχωρήθηκε." });
      setNewPayment({
        title: "",
        amount: "",
        due_date: new Date().toISOString().split('T')[0],
        method: "bank_transfer",
        notes: ""
      });
      onClose();
      onPaymentAdded();
    } catch (error) {
      console.error("Error creating payment:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας πληρωμής.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Νέα Πληρωμή
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Περιγραφή Πληρωμής</Label>
            <Input
              value={newPayment.title}
              onChange={(e) => setNewPayment(prev => ({...prev, title: e.target.value}))}
              placeholder="π.χ. Δεύτερη δόση εργασιών"
            />
          </div>

          <div>
            <Label>Ποσό (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={newPayment.amount}
              onChange={(e) => setNewPayment(prev => ({...prev, amount: e.target.value}))}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Προβλεπόμενη Ημερομηνία</Label>
            <Input
              type="date"
              value={newPayment.due_date}
              onChange={(e) => setNewPayment(prev => ({...prev, due_date: e.target.value}))}
            />
          </div>

          <div>
            <Label>Τρόπος Πληρωμής</Label>
            <Select value={newPayment.method} onValueChange={(value) => setNewPayment(prev => ({...prev, method: value}))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Μετρητά</SelectItem>
                <SelectItem value="bank_transfer">Τραπεζική Μεταφορά</SelectItem>
                <SelectItem value="card">Κάρτα</SelectItem>
                <SelectItem value="check">Επιταγή</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Σημειώσεις</Label>
            <Input
              value={newPayment.notes}
              onChange={(e) => setNewPayment(prev => ({...prev, notes: e.target.value}))}
              placeholder="Προαιρετικές σημειώσεις..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Άκυρο</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-bg text-white">
            {isSaving ? "Αποθήκευση..." : "Καταχώρηση"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentsDetail({ project, payments, expenses, proposalItems, onPaymentUpdate, reloadProjectData }) {
  const [showNewPaymentDialog, setShowNewPaymentDialog] = useState(false);
  const { toast } = useToast();

  const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const totalRevenue = project.budget_total || 0;
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const outstandingAmount = totalRevenue - paidAmount;

  const handleMarkAsPaid = async (payment) => {
    try {
      await Payment.update(payment.id, { 
        status: 'paid', 
        paid_at: new Date().toISOString(),
        method: payment.method || 'bank_transfer'
      });
      toast({ title: "Επιτυχία!", description: `Η πληρωμή "${payment.title}" σημειώθηκε ως πληρωμένη.` });
      reloadProjectData();
    } catch (error) {
      console.error("Error updating payment:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία ενημέρωσης πληρωμής.", variant: "destructive" });
    }
  };

  const handleMarkAsPending = async (payment) => {
    try {
      await Payment.update(payment.id, { 
        status: 'pending', 
        paid_at: null 
      });
      toast({ title: "Επιτυχία!", description: `Η πληρωμή "${payment.title}" σημειώθηκε ως εκκρεμής.` });
      reloadProjectData();
    } catch (error) {
      console.error("Error updating payment:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία ενημέρωσης πληρωμής.", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle>Ανάλυση Κόστους (από Προσφορά)</CardTitle>
          </CardHeader>
          <CardContent>
            {proposalItems && proposalItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Περιγραφή</TableHead>
                    <TableHead className="text-right">Ποσότητα</TableHead>
                    <TableHead className="text-right">Τιμή Μον.</TableHead>
                    <TableHead className="text-right">Σύνολο Γραμμής</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposalItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-right">€{item.unit_price?.toLocaleString('el-GR')}</TableCell>
                      <TableCell className="text-right font-medium">€{item.line_total?.toLocaleString('el-GR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-slate-500 text-sm">Δεν υπάρχει ανάλυση κόστους από προσφορά.</p>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Ιστορικό Πληρωμών
              </CardTitle>
              <Button 
                onClick={() => setShowNewPaymentDialog(true)}
                className="gradient-bg text-white"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Νέα Πληρωμή
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {payments && payments.length > 0 ? (
              <div className="space-y-3">
                {payments.map(payment => {
                  const StatusIcon = statusIcons[payment.status];
                  const MethodIcon = methodIcons[payment.method] || CreditCard;
                  const statusStyle = statusColors[payment.status];
                  
                  return (
                    <div key={payment.id} className={`flex items-center justify-between p-4 border ${statusStyle.border} bg-gradient-to-r ${statusStyle.bg} rounded-lg`}>
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusStyle.bg}`}>
                          <StatusIcon className={`w-5 h-5 ${statusStyle.text}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900">{payment.title}</h4>
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {payment.status === 'paid' && payment.paid_at 
                                  ? `Πληρώθηκε: ${format(new Date(payment.paid_at), 'dd MMM yyyy', { locale: el })}`
                                  : `Λήξη: ${format(new Date(payment.due_date), 'dd MMM yyyy', { locale: el })}`
                                }
                              </span>
                            </div>
                            {payment.method && (
                              <div className="flex items-center gap-1">
                                <MethodIcon className="w-4 h-4" />
                                <span>{methodLabels[payment.method]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xl font-bold text-slate-900">
                            €{payment.amount?.toLocaleString('el-GR')}
                          </div>
                          <Badge className={`${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                            {statusLabels[payment.status]}
                          </Badge>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {payment.status !== 'paid' && (
                              <DropdownMenuItem
                                onClick={() => handleMarkAsPaid(payment)}
                                className="text-emerald-600"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Σημείωση ως Πληρωμένη
                              </DropdownMenuItem>
                            )}
                            {payment.status === 'paid' && (
                              <DropdownMenuItem
                                onClick={() => handleMarkAsPending(payment)}
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                Σημείωση ως Εκκρεμής
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Δεν έχουν καταχωρηθεί πληρωμές ακόμα.</p>
                <Button 
                  onClick={() => setShowNewPaymentDialog(true)}
                  className="gradient-bg text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Προσθήκη Πρώτης Πληρωμής
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Euro className="w-5 h-5 text-blue-600" />
              Οικονομική Επισκόπηση
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-white/60 p-3 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-600">Συνολικά Έσοδα</p>
              <p className="text-lg font-bold text-slate-800">€{totalRevenue.toLocaleString('el-GR')}</p>
            </div>
            
            <div className="flex justify-between items-center bg-white/60 p-3 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-600">Συνολικά Έξοδα</p>
              <p className="text-lg font-bold text-red-600">- €{totalExpenses.toLocaleString('el-GR')}</p>
            </div>
            
            <div className={`flex justify-between items-center p-4 rounded-lg border ${netProfit >= 0 ? 'bg-emerald-100 border-emerald-200' : 'bg-red-100 border-red-200'}`}>
              <p className={`text-md font-bold ${netProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>Καθαρό Κέρδος</p>
              <p className={`text-xl font-extrabold ${netProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>€{netProfit.toLocaleString('el-GR')}</p>
            </div>
            
            <hr className="my-4"/>

            <div className="bg-emerald-100 p-3 rounded-lg border border-emerald-200">
              <p className="text-sm font-medium text-emerald-700">Εισπραγμένα</p>
              <p className="text-2xl font-bold text-emerald-700">€{paidAmount.toLocaleString('el-GR')}</p>
            </div>
            
            <div className="bg-amber-100 p-3 rounded-lg border border-amber-200">
              <p className="text-sm font-medium text-amber-700">Υπόλοιπο προς Είσπραξη</p>
              <p className="text-2xl font-bold text-amber-700">€{Math.max(0, outstandingAmount).toLocaleString('el-GR')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewPaymentDialog
        isOpen={showNewPaymentDialog}
        onClose={() => setShowNewPaymentDialog(false)}
        project={project}
        onPaymentAdded={reloadProjectData}
      />
    </div>
  );
}

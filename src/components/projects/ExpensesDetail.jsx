
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
import { Expense } from '@/api/entities';
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Plus, Banknote, Fuel, HardHat, Wrench, Package, Loader2, Trash2 } from 'lucide-react';

const categoryLabels = {
    materials: "Υλικά",
    labor: "Εργατικά",
    equipment: "Εξοπλισμός",
    fuel: "Κάυσιμα",
    subcontractor: "Υπεργολάβος",
    other: "Διάφορα"
};

const categoryIcons = {
    materials: <Package className="w-4 h-4" />,
    labor: <HardHat className="w-4 h-4" />,
    equipment: <Wrench className="w-4 h-4" />,
    fuel: <Fuel className="w-4 h-4" />,
    subcontractor: <HardHat className="w-4 h-4" />,
    other: <Package className="w-4 h-4" />
};

function NewExpenseDialog({ isOpen, onClose, project, onExpenseAdded }) {
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: "",
    expense_date: new Date().toISOString().split('T')[0],
    category: "materials"
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!newExpense.title || !newExpense.amount || !newExpense.category) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε όλα τα πεδία.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await Expense.create({
        organization_id: project.organization_id,
        project_id: project.id,
        title: newExpense.title,
        amount: parseFloat(newExpense.amount),
        expense_date: newExpense.expense_date,
        category: newExpense.category,
      });

      toast({ title: "Επιτυχία!", description: "Το νέο έξοδο καταχωρήθηκε." });
      onClose();
      onExpenseAdded();
    } catch (error) {
      console.error("Error creating expense:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας εξόδου.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Νέο Έξοδο</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Περιγραφή</Label>
            <Input id="title" value={newExpense.title} onChange={(e) => setNewExpense(p => ({...p, title: e.target.value}))} />
          </div>
          <div>
            <Label htmlFor="amount">Ποσό (€)</Label>
            <Input id="amount" type="number" value={newExpense.amount} onChange={(e) => setNewExpense(p => ({...p, amount: e.target.value}))} />
          </div>
          <div>
            <Label htmlFor="category">Κατηγορία</Label>
            <Select value={newExpense.category} onValueChange={(value) => setNewExpense(p => ({...p, category: value}))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="expense_date">Ημερομηνία</Label>
            <Input id="expense_date" type="date" value={newExpense.expense_date} onChange={(e) => setNewExpense(p => ({...p, expense_date: e.target.value}))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Άκυρο</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Αποθήκευση
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExpensesDetail({ project, expenses, reloadProjectData }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const handleDelete = async (expenseId) => {
        try {
            await Expense.delete(expenseId);
            toast({ title: "Επιτυχία!", description: "Το έξοδο διαγράφηκε." });
            reloadProjectData();
        } catch (error) {
            console.error("Error deleting expense:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής εξόδου.", variant: "destructive" });
        }
    };

    return (
        <>
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="w-5 h-5 text-red-600" />
                            Έξοδα Έργου
                        </CardTitle>
                        <Button onClick={() => setIsDialogOpen(true)} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Νέο Έξοδο
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {expenses && expenses.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Περιγραφή</TableHead>
                                    <TableHead>Κατηγορία</TableHead>
                                    <TableHead>Ημερομηνία</TableHead>
                                    <TableHead className="text-right">Ποσό</TableHead>
                                    <TableHead className="text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.map(expense => (
                                    <TableRow key={expense.id}>
                                        <TableCell className="font-medium">{expense.title}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="flex items-center gap-1.5">
                                                {categoryIcons[expense.category]}
                                                {categoryLabels[expense.category]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(expense.expense_date), 'dd MMM yyyy', { locale: el })}</TableCell>
                                        <TableCell className="text-right font-semibold">€{expense.amount.toLocaleString('el-GR')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="bg-slate-50 font-bold">
                                    <TableCell colSpan={3}>Σύνολο Εξόδων</TableCell>
                                    <TableCell className="text-right text-base">€{totalExpenses.toLocaleString('el-GR')}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8">
                            <Banknote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 mb-4">Δεν έχουν καταχωρηθεί έξοδα ακόμα.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <NewExpenseDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} project={project} onExpenseAdded={reloadProjectData} />
        </>
    );
}

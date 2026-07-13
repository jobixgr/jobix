
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Plus, 
  Search, 
  Calendar,
  Euro,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreVertical // Προσθήκη icon
} from "lucide-react";
import { Payment, User } from "@/api/entities"; // Add User
import { format, isAfter, isBefore, addDays } from "date-fns";
import { el } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast"; // Προσθήκη toast
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusColors = {
  pending: "bg-slate-100 text-slate-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700"
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

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentToUpdate, setPaymentToUpdate] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    let filtered = payments.map(payment => {
      // Auto-update status for overdue payments
      const updatedPayment = { ...payment };
      if (payment.status === 'pending' && payment.due_date) {
        const today = new Date();
        const dueDate = new Date(payment.due_date);
        if (isBefore(dueDate, today) && !payment.paid_at) { // Only mark overdue if not already paid
          updatedPayment.status = 'overdue';
        }
      }
      return updatedPayment;
    });
    
    if (searchQuery) {
      filtered = filtered.filter(payment => 
        payment.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }
    
    setFilteredPayments(filtered);
  }, [payments, searchQuery, statusFilter]);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser || !currentUser.organization_id) {
        console.log("❌ No user or organization_id found");
        setIsLoading(false);
        return;
      }
      
      console.log("🔄 Loading payments for organization:", currentUser.organization_id);
      const data = await Payment.filter({ organization_id: currentUser.organization_id }, '-due_date');
      console.log("✅ Payments loaded:", data.length, "payments found");
      console.log("Payment data:", data);
      
      setPayments(data);
    } catch (error) {
      console.error('❌ Error loading payments:', error);
    }
    setIsLoading(false);
  };

  const handleStatusUpdateRequest = (payment, status) => {
    setPaymentToUpdate(payment);
    setNewStatus(status);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!paymentToUpdate) return;

    try {
      const dataToUpdate = { status: newStatus };
      if (newStatus === 'paid') {
        dataToUpdate.paid_at = new Date().toISOString();
      } else {
        dataToUpdate.paid_at = null; // Reset paid_at if moved back to pending
      }
      
      await Payment.update(paymentToUpdate.id, dataToUpdate);
      
      toast({
        title: "Επιτυχία!",
        description: `Η κατάσταση της πληρωμής άλλαξε σε "${statusLabels[newStatus]}".`
      });

      loadPayments(); // Refresh data
    } catch (error) {
      console.error("Failed to update payment status:", error);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία ενημέρωσης κατάστασης.",
        variant: "destructive"
      });
    } finally {
      setPaymentToUpdate(null);
      setNewStatus("");
    }
  };
  
  const getTotalStats = () => {
    const processed = payments.map(payment => { // Use 'payments' here to calculate total stats before filtering
      const updatedPayment = { ...payment };
      if (payment.status === 'pending' && payment.due_date) {
        const today = new Date();
        const dueDate = new Date(payment.due_date);
        if (isBefore(dueDate, today) && !payment.paid_at) { // Only mark overdue if not already paid
          updatedPayment.status = 'overdue';
        }
      }
      return updatedPayment;
    });

    return {
      total: processed.reduce((sum, p) => sum + (p.amount || 0), 0),
      pending: processed.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0),
      paid: processed.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
      overdue: processed.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0)
    };
  };

  const stats = getTotalStats();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Πληρωμές</h1>
            <p className="text-slate-600">Παρακολούθησε όλες τις πληρωμές και τα υπόλοιπα των έργων σου</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Euro className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Σύνολο</p>
                  <p className="text-xl font-bold text-slate-900">€{stats.total.toLocaleString('el-GR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Εκκρεμείς</p>
                  <p className="text-xl font-bold text-slate-900">€{stats.pending.toLocaleString('el-GR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Πληρωμένες</p>
                  <p className="text-xl font-bold text-emerald-600">€{stats.paid.toLocaleString('el-GR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Εκπρόθεσμες</p>
                  <p className="text-xl font-bold text-red-600">€{stats.overdue.toLocaleString('el-GR')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <Input
                  placeholder="Αναζήτηση πληρωμών..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "all", label: "Όλες" },
                  { value: "pending", label: "Εκκρεμείς" },
                  { value: "paid", label: "Πληρωμένες" },
                  { value: "overdue", label: "Εκπρόθεσμες" }
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={statusFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    className={statusFilter === filter.value ? "gradient-bg text-white" : ""}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardContent className="p-3 md:p-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl">
                      <div className="flex-1">
                        <div className="h-5 bg-slate-200 rounded w-48 mb-2"></div>
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                      </div>
                      <div className="h-6 bg-slate-200 rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  {searchQuery || statusFilter !== "all" ? "Δεν βρέθηκαν πληρωμές" : "Δεν υπάρχουν πληρωμές ακόμα"}
                </h3>
                <p className="text-slate-500 mb-6">
                  {searchQuery || statusFilter !== "all" 
                    ? "Δοκίμασε να αλλάξεις τα φίλτρα αναζήτησης"
                    : "Οι πληρωμές θα εμφανιστούν όταν δημιουργήσεις έργα"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((payment) => {
                  // Update status for overdue payments for display purposes
                  let currentStatus = payment.status;
                  if (payment.status === 'pending' && payment.due_date) {
                    const today = new Date();
                    const dueDate = new Date(payment.due_date);
                    if (isBefore(dueDate, today) && !payment.paid_at) { // Only mark overdue if not already paid
                      currentStatus = 'overdue';
                    }
                  }

                  const StatusIcon = statusIcons[currentStatus];
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 md:p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          currentStatus === 'paid' ? 'bg-emerald-100' :
                          currentStatus === 'overdue' ? 'bg-red-100' :
                          'bg-slate-100'
                        }`}>
                          <StatusIcon className={`w-6 h-6 ${
                            currentStatus === 'paid' ? 'text-emerald-600' :
                            currentStatus === 'overdue' ? 'text-red-600' :
                            'text-slate-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 mb-1">
                            {payment.title}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            {payment.due_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(payment.due_date), 'dd MMM yyyy', { locale: el })}
                              </div>
                            )}
                            <div className="flex items-center gap-1 font-semibold text-slate-700">
                              <Euro className="w-4 h-4" />
                              {payment.amount.toLocaleString('el-GR')}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 md:gap-2">
                          <Badge className={`${statusColors[currentStatus]} text-xs`}>
                            {statusLabels[currentStatus]}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4 text-slate-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {currentStatus !== 'paid' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdateRequest(payment, 'paid')}
                                  className="text-emerald-600"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Επισήμανση ως Πληρωμένη
                                </DropdownMenuItem>
                              )}
                              {currentStatus === 'paid' && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdateRequest(payment, 'pending')}
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  Επισήμανση ως Εκκρεμής
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!paymentToUpdate} onOpenChange={() => setPaymentToUpdate(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Επιβεβαίωση Αλλαγής</AlertDialogTitle>
                  <AlertDialogDescription>
                      Είστε σίγουροι ότι θέλετε να αλλάξετε την κατάσταση αυτής της πληρωμής σε "{newStatus ? statusLabels[newStatus] : ''}"?
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPaymentToUpdate(null)}>Άκυρο</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmStatusUpdate} className="gradient-bg text-white">
                      Επιβεβαίωση
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

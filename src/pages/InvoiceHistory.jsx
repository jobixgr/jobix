
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  FileText, 
  Download, 
  Send, 
  Calendar,
  Euro,
  CheckCircle2,
  Clock,
  Mail,
  Loader2,
  Building2
} from "lucide-react";
import { Invoice, User, Organization } from "@/api/entities";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { el } from "date-fns/locale";

export default function InvoiceHistory() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [accountantEmail, setAccountantEmail] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser?.organization_id) {
        setIsLoading(false);
        return;
      }

      const [invoicesData, orgData] = await Promise.all([
        Invoice.filter({ organization_id: currentUser.organization_id }, '-issue_date'),
        Organization.get(currentUser.organization_id)
      ]);

      setInvoices(invoicesData);
      setOrganization(orgData);
      setAccountantEmail(orgData.accountant_email || "");
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης δεδομένων.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]); // Added toast as a dependency for useCallback

  useEffect(() => {
    loadData();
  }, [loadData]); // Added loadData as a dependency for useEffect

  // Group invoices by month/year
  const groupInvoicesByMonth = () => {
    const grouped = {};
    invoices.forEach(invoice => {
      if (!invoice.issue_date) return;
      
      const date = new Date(invoice.issue_date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const monthName = format(date, 'MMMM yyyy', { locale: el });
      
      if (!grouped[key]) {
        grouped[key] = {
          monthName,
          date,
          invoices: [],
          total: 0,
          sent_to_accountant: false
        };
      }
      
      grouped[key].invoices.push(invoice);
      grouped[key].total += invoice.total || 0;
    });

    // Sort by date descending
    return Object.values(grouped).sort((a, b) => b.date - a.date);
  };

  const monthlyGroups = groupInvoicesByMonth();

  const exportMonthToPDF = async (monthGroup) => {
    // This would generate a PDF with all invoices for the month
    toast({ 
      title: "Εξαγωγή PDF", 
      description: `Εξαγωγή ${monthGroup.invoices.length} παραστατικών για ${monthGroup.monthName}`,
      variant: "default"
    });
  };

  const sendToAccountant = async (monthGroup) => {
    if (!accountantEmail) {
      toast({ 
        title: "Σφάλμα", 
        description: "Παρακαλώ εισάγετε το email του λογιστή σας.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Here we would send email to accountant with monthly summary
      toast({ 
        title: "Email Στάλθηκε! 📧", 
        description: `Τα παραστατικά του ${monthGroup.monthName} στάλθηκαν στο ${accountantEmail}` 
      });
      
      // Mark as sent (in a real app, you'd track this in the database)
      monthGroup.sent_to_accountant = true;
    } catch (error) {
      toast({ 
        title: "Σφάλμα Αποστολής", 
        description: "Δεν ήταν δυνατή η αποστολή του email.", 
        variant: "destructive" 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-64"></div>
            <div className="h-96 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Ιστορικό Παραστατικών</h1>
            <p className="text-slate-600">Διαχειρίσου και στείλε τα παραστατικά στο λογιστή σου</p>
          </div>
          {organization && (
            <div className="text-right">
              <p className="text-sm text-slate-500">Οργανισμός</p>
              <p className="font-semibold text-slate-900">{organization.name}</p>
            </div>
          )}
        </div>

        {/* Accountant Email Settings */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Στοιχεία Λογιστή
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="accountant-email">Email Λογιστή</Label>
                <Input
                  id="accountant-email"
                  type="email"
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                  placeholder="π.χ. logistis@example.gr"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline"
                  onClick={async () => {
                    // Save accountant email to organization
                    await Organization.update(organization.id, { accountant_email: accountantEmail });
                    toast({ title: "Αποθηκεύτηκε!", description: "Το email του λογιστή αποθηκεύτηκε." });
                  }}
                >
                  Αποθήκευση
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Groups */}
        <div className="space-y-4">
          {monthlyGroups.length === 0 ? (
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  Δεν υπάρχουν παραστατικά ακόμα
                </h3>
                <p className="text-slate-500">
                  Δημιουργήστε τιμολόγια για να εμφανιστούν εδώ.
                </p>
              </CardContent>
            </Card>
          ) : (
            monthlyGroups.map((monthGroup, index) => (
              <Card key={index} className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                <CardHeader>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{monthGroup.monthName}</CardTitle>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-slate-500 text-sm">
                            {monthGroup.invoices.length} παραστατικά
                          </span>
                          <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                            <Euro className="w-4 h-4" />
                            {monthGroup.total.toLocaleString('el-GR')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {monthGroup.sent_to_accountant ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Στάλθηκε
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3 mr-1" />
                          Εκκρεμεί
                        </Badge>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportMonthToPDF(monthGroup)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => sendToAccountant(monthGroup)}
                        disabled={!accountantEmail || monthGroup.sent_to_accountant}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Send className="w-4 h-4 mr-1" />
                        {monthGroup.sent_to_accountant ? 'Στάλθηκε' : 'Αποστολή'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-2">
                    {monthGroup.invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                            <FileText className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              Τιμολόγιο #{invoice.number}
                            </p>
                            <p className="text-sm text-slate-500">
                              {format(new Date(invoice.issue_date), 'dd MMM yyyy', { locale: el })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            €{(invoice.total || 0).toLocaleString('el-GR')}
                          </p>
                          <Badge 
                            className={
                              invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }
                          >
                            {invoice.status === 'paid' ? 'Πληρωμένο' :
                             invoice.status === 'sent' ? 'Στάλθηκε' : 'Πρόχειρο'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Summary Stats */}
        {monthlyGroups.length > 0 && (
          <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-blue-100 text-sm">Σύνολο Παραστατικών</p>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-100 text-sm">Συνολική Αξία</p>
                  <p className="text-2xl font-bold">
                    €{invoices.reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('el-GR')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-100 text-sm">Μήνες με Δραστηριότητα</p>
                  <p className="text-2xl font-bold">{monthlyGroups.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

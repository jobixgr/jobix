
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, Download, Send, Printer, Edit, QrCode, AlertCircle, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Invoice, InvoiceItem, Organization } from "@/api/entities";
import { sendInvoiceEmail } from "@/api/functions";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700", 
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700"
};

const statusLabels = {
  draft: "Πρόχειρο",
  sent: "Στάλθηκε",
  paid: "Πληρωμένο", 
  overdue: "Εκπρόθεσμο"
};

export default function InvoiceView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Changed initial state from true to false

  // Get invoice ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');

  const loadInvoice = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invoiceData, itemsData] = await Promise.all([
        Invoice.get(invoiceId),
        InvoiceItem.filter({ invoice_id: invoiceId })
      ]);

      if (!invoiceData) {
        toast({ title: "Σφάλμα", description: "Το τιμολόγιο δεν βρέθηκε.", variant: "destructive" });
        navigate(createPageUrl('Invoices'));
        return;
      }

      setInvoice(invoiceData);
      setInvoiceItems(itemsData);

      // Load organization
      const orgData = await Organization.get(invoiceData.organization_id);
      setOrganization(orgData);

    } catch (error) {
      console.error("Error loading invoice:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης τιμολογίου.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [invoiceId, navigate, toast]); // Added navigate and toast to useCallback dependencies

  useEffect(() => {
    if (!invoiceId) {
      toast({ title: "Σφάλμα", description: "Δεν βρέθηκε ID τιμολογίου.", variant: "destructive" });
      navigate(createPageUrl('Invoices'));
      return;
    }
    
    loadInvoice();
  }, [invoiceId, loadInvoice, navigate, toast]); // Added loadInvoice, navigate, and toast to useEffect dependencies

  const handlePrint = () => {
    window.print();
  };

  const [isSending, setIsSending] = useState(false);

  const handleSendInvoice = async () => {
    if (isSending) return;  // προστασία από διπλό πάτημα
    const clientEmail = invoice?.client_details?.email;
    if (!clientEmail) {
      toast({
        title: "Λείπει email",
        description: "Ο πελάτης δεν έχει καταχωρημένο email. Προσθέστε το από την καρτέλα του πελάτη.",
        variant: "destructive",
      });
      return;
    }
    setIsSending(true);
    try {
      const res = await sendInvoiceEmail({ invoiceId: invoice.id });
      if (res?.emailSent) {
        toast({
          title: "Στάλθηκε!",
          description: `Το παραστατικό στάλθηκε στο ${clientEmail}.`,
        });
      } else {
        toast({
          title: "Δεν στάλθηκε",
          description: "Το email δεν είναι ρυθμισμένο. Ελέγξτε τις ρυθμίσεις.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Σφάλμα αποστολής",
        description: e.message || "Δοκιμάστε ξανά.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-200 rounded w-64"></div>
            <div className="h-96 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-600 mb-2">Τιμολόγιο Δεν Βρέθηκε</h3>
          <p className="text-slate-500 mb-6">Το τιμολόγιο που ψάχνετε δεν υπάρχει ή έχει διαγραφεί.</p>
          <Link to={createPageUrl('Invoices')}>
            <Button className="gradient-bg text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Επιστροφή στα Τιμολόγια
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 no-print">
          <div>
            <Link to={createPageUrl("Invoices")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
              <ArrowLeft className="w-4 h-4" />
              Επιστροφή στα Τιμολόγια
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              Τιμολόγιο #{invoice.number}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={statusColors[invoice.status]}>
                {statusLabels[invoice.status]}
              </Badge>
              {invoice.issue_date && (
                <span className="text-slate-500 text-sm">
                  {format(new Date(invoice.issue_date), 'dd MMM yyyy', { locale: el })}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={handlePrint} className="flex-1 md:flex-initial">
              <Printer className="w-4 h-4 mr-2" />
              Εκτύπωση
            </Button>
            <Button
              variant="outline"
              className="flex-1 md:flex-initial"
              onClick={handleSendInvoice}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isSending ? 'Αποστολή...' : 'Αποστολή'}
            </Button>
          </div>
        </div>

        {/* Invoice Content */}
        <Card className="bg-white shadow-lg print:shadow-none print:border-none">
          <CardContent className="p-6 md:p-10">
            {/* Header Section */}
            <div className="grid grid-cols-2 gap-8 mb-10">
              {/* Εκδότης */}
              <div>
                <h2 className="font-semibold text-slate-500 text-sm mb-3">ΣΤΟΙΧΕΙΑ ΕΚΔΟΤΗ</h2>
                {organization && (
                  <div className="space-y-1 text-slate-800">
                    <p className="text-lg font-bold text-slate-900">{organization.name}</p>
                    {organization.address && <p>{organization.address}</p>}
                    <p>ΑΦΜ: {organization.afm || 'Δεν έχει οριστεί'}</p>
                    <p>ΔΟΥ: {organization.doy || 'Δεν έχει οριστεί'}</p>
                    {organization.email && <p>Email: {organization.email}</p>}
                    {organization.phone && <p>Τηλ: {organization.phone}</p>}
                  </div>
                )}
              </div>
              
              {/* Στοιχεία Παραστατικού */}
              <div className="text-right">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">ΤΙΜΟΛΟΓΙΟ</h1>
                <div className="space-y-1 text-slate-700">
                    <p><span className="font-semibold">Αριθμός:</span> #{invoice.number}</p>
                    {invoice.issue_date && (
                    <p>
                        <span className="font-semibold">Ημερομηνία:</span> {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: el })}
                    </p>
                    )}
                </div>
              </div>
            </div>

            {/* Client Details */}
            {invoice.client_details && (
              <div className="mb-10 p-4 bg-slate-50 rounded-lg border">
                <h3 className="font-semibold text-slate-500 text-sm mb-3">ΣΤΟΙΧΕΙΑ ΛΗΠΤΗ</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-slate-800">
                    <p className="font-bold text-slate-900 col-span-2">{invoice.client_details.name}</p>
                    {invoice.client_details.profession && <p>Επάγγελμα: {invoice.client_details.profession}</p>}
                    {invoice.client_details.address && (
                        <p>Διεύθυνση: {invoice.client_details.address}
                        {invoice.client_details.postal_code && `, ${invoice.client_details.postal_code}`}
                        {invoice.client_details.city && ` ${invoice.client_details.city}`}
                        </p>
                    )}
                    {invoice.client_details.afm && <p>ΑΦΜ: {invoice.client_details.afm}</p>}
                    {invoice.client_details.doy && <p>ΔΟΥ: {invoice.client_details.doy}</p>}
                    {invoice.client_details.email && <p>Email: {invoice.client_details.email}</p>}
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="mb-8 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100">
                    <th className="text-left py-2 px-3 font-semibold text-slate-600 text-sm">ΠΕΡΙΓΡΑΦΗ</th>
                    <th className="text-center py-2 px-3 font-semibold text-slate-600 text-sm w-24">ΠΟΣΟΤΗΤΑ</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600 text-sm w-28">ΤΙΜΗ ΜΟΝΑΔΑΣ</th>
                    <th className="text-center py-2 px-3 font-semibold text-slate-600 text-sm w-20">ΦΠΑ %</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600 text-sm w-32">ΑΞΙΑ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item) => (
                    <tr key={item.id} className="border-b border-slate-200">
                      <td className="py-3 px-3 text-slate-900">{item.description}</td>
                      <td className="py-3 px-3 text-center text-slate-700">{item.quantity} {item.unit}</td>
                      <td className="py-3 px-3 text-right text-slate-700">€{item.unit_price?.toFixed(2)}</td>
                      <td className="py-3 px-3 text-center text-slate-700">{item.vat_rate}%</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-900">€{item.line_total?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & myDATA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* myDATA Placeholder */}
                <div>
                     <Alert className="bg-amber-50 border-amber-200 h-full">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-amber-800">Προσοχή: Δεν αποτελεί φορολογικό παραστατικό</AlertTitle>
                        <AlertDescription className="text-amber-700">
                            Το έγγραφο αυτό είναι εσωτερικό αρχείο / ειδοποίηση πληρωμής και δεν έχει διαβιβαστεί στο myDATA.
                            Το επίσημο παραστατικό πρέπει να εκδοθεί μέσω πιστοποιημένου παρόχου ηλεκτρονικής τιμολόγησης
                            ή της δωρεάν εφαρμογής timologio της ΑΑΔΕ.
                        </AlertDescription>
                    </Alert>
                </div>
                {/* Totals */}
                <div className="space-y-2">
                    <div className="flex justify-between py-2 text-slate-700 border-b">
                        <span>Καθαρή Αξία:</span>
                        <span className="font-medium">€{(invoice.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {invoice.vat_amount > 0 && (
                    <div className="flex justify-between py-2 text-slate-700 border-b">
                        <span>Σύνολο ΦΠΑ:</span>
                        <span className="font-medium">€{(invoice.vat_amount || 0).toFixed(2)}</span>
                    </div>
                    )}
                    <div className="flex justify-between py-3 text-xl font-bold text-slate-900 bg-slate-100 px-3 rounded-md">
                        <span>Πληρωτέο Ποσό:</span>
                        <span className="gradient-text">€{(invoice.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="border-t border-slate-200 pt-6 mt-10">
                <h4 className="font-semibold text-slate-600 text-sm mb-2">ΟΡΟΙ & ΣΗΜΕΙΩΣΕΙΣ:</h4>
                <p className="text-slate-700 text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        @media print {
          body { -webkit-print-color-adjust: exact; background-color: white !important; }
          .no-print { display: none !important; }
          .gradient-text { 
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .p-4, .p-8 { padding: 0 !important; }
          .bg-slate-50 { background-color: white !important; }
        }
      `}</style>
    </div>
  );
}

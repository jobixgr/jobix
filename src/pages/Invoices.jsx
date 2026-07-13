
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Receipt,
  Plus,
  Search,
  ArrowRight,
  Calendar,
  Euro,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle
} from "lucide-react";
import { Invoice, User } from "@/api/entities"; // Add User
import { format } from "date-fns";
import { el } from "date-fns/locale";

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

const statusIcons = {
  draft: Receipt,
  sent: Send,
  paid: CheckCircle2,
  overdue: AlertTriangle
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    let filtered = invoices;

    if (searchQuery) {
      filtered = filtered.filter(invoice =>
        invoice.number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [invoices, searchQuery, statusFilter]);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me(); // Fetch current user
      if (!currentUser || !currentUser.organization_id) { // Check if organization_id exists
        setIsLoading(false);
        return;
      }
      // Filter invoices by organization_id
      const data = await Invoice.filter({ organization_id: currentUser.organization_id }, '-issue_date');
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
    setIsLoading(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Τιμολόγια</h1>
            <p className="text-slate-600">Διαχειρίσου τα τιμολόγια και τις πληρωμές σου</p>
          </div>
          <Link to={createPageUrl("InvoiceNew")}>
            <Button className="gradient-bg text-white w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Νέο Τιμολόγιο
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <Input
                  placeholder="Αναζήτηση τιμολογίων..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "all", label: "Όλα" },
                  { value: "draft", label: "Πρόχειρα" },
                  { value: "sent", label: "Σταλμένα" },
                  { value: "paid", label: "Πληρωμένα" },
                  { value: "overdue", label: "Εκπρόθεσμα" }
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

        {/* Invoices List */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardContent className="p-6">
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
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  Δεν υπάρχουν τιμολόγια ακόμα
                </h3>
                <p className="text-slate-500 mb-6">
                  Δημιούργησε το πρώτο σου τιμολόγιο για να ξεκινήσεις.
                </p>
                <Link to={createPageUrl("InvoiceNew")}>
                  <Button className="gradient-bg text-white">
                    <Plus className="w-5 h-5 mr-2" />
                    Δημιουργία Τιμολογίου
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInvoices.map((invoice) => {
                  const StatusIcon = statusIcons[invoice.status];
                  return (
                    <Link
                      key={invoice.id}
                      to={createPageUrl("InvoiceView") + "?id=" + invoice.id}
                      className="block hover:bg-slate-50 transition-colors rounded-xl"
                    >
                      <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl group">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusColors[invoice.status]}`}>
                            <StatusIcon className={`w-6 h-6 ${statusColors[invoice.status].replace('bg-', 'text-').replace('-100', '-600')}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-purple-600 transition-colors">
                              Τιμολόγιο #{invoice.number}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-slate-500">
                              {invoice.issue_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {format(new Date(invoice.issue_date), 'dd MMM yyyy', { locale: el })}
                                </div>
                              )}
                              {invoice.total && (
                                <div className="flex items-center gap-1 font-semibold">
                                  <Euro className="w-4 h-4" />
                                  {invoice.total.toLocaleString('el-GR')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={statusColors[invoice.status]}>
                            {statusLabels[invoice.status]}
                          </Badge>
                          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

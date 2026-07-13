import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { CreditCard, ArrowRight, AlertTriangle, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { el } from "date-fns/locale";

export default function PendingPayments({ payments, isLoading }) {
  if (isLoading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Εκκρεμείς Πληρωμές
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPaymentStatus = (dueDate) => {
    const due = new Date(dueDate);
    const today = new Date();
    const soon = addDays(today, 7);

    if (isBefore(due, today)) {
      return { status: 'overdue', label: 'Εκπρόθεσμη', color: 'bg-red-100 text-red-700' };
    } else if (isBefore(due, soon)) {
      return { status: 'due_soon', label: 'Λήγει Σύντομα', color: 'bg-yellow-100 text-yellow-700' };
    } else {
      return { status: 'pending', label: 'Εκκρεμής', color: 'bg-slate-100 text-slate-700' };
    }
  };

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            Εκκρεμείς Πληρωμές
          </CardTitle>
          <Link to={createPageUrl("Payments")}>
            <Button variant="outline" size="sm" className="text-slate-600">
              Όλες
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="text-center py-6">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">Δεν υπάρχουν εκκρεμείς πληρωμές</p>
            </div>
          ) : (
            payments.map((payment) => {
              const paymentStatus = getPaymentStatus(payment.due_date);
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900 truncate">{payment.title}</h4>
                      {paymentStatus.status === 'overdue' && (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(payment.due_date), 'dd MMM', { locale: el })}
                      </div>
                      <span className="font-semibold">€{payment.amount.toLocaleString('el-GR')}</span>
                    </div>
                  </div>
                  <Badge className={`text-xs ${paymentStatus.color}`}>
                    {paymentStatus.label}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
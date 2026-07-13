import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Added CardDescription
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Euro } from "lucide-react";
import { format, subMonths, getMonth, getYear } from 'date-fns';
import { el } from 'date-fns/locale';

export default function MonthlyFinancialChart({ payments, expenses, isLoading }) {
  const processData = () => {
    const dataMap = new Map();
    const twelveMonthsAgo = subMonths(new Date(), 11);

    // Initialize last 12 months
    for (let i = 0; i < 12; i++) {
        const date = subMonths(new Date(), 11 - i);
        const monthKey = `${getYear(date)}-${getMonth(date)}`;
        const monthName = format(date, 'MMM', { locale: el });
        dataMap.set(monthKey, { name: monthName, 'Έσοδα': 0, 'Έξοδα': 0 });
    }

    if (payments) {
        payments.forEach(payment => {
            if (payment.status === 'paid' && payment.paid_at) {
                const paymentDate = new Date(payment.paid_at);
                if (paymentDate >= twelveMonthsAgo) {
                    const monthKey = `${getYear(paymentDate)}-${getMonth(paymentDate)}`;
                    if (dataMap.has(monthKey)) {
                        dataMap.get(monthKey)['Έσοδα'] += payment.amount || 0;
                    }
                }
            }
        });
    }

    if (expenses) {
        expenses.forEach(expense => {
            const expenseDate = new Date(expense.expense_date);
            if (expenseDate >= twelveMonthsAgo) {
                const monthKey = `${getYear(expenseDate)}-${getMonth(expenseDate)}`;
                if (dataMap.has(monthKey)) {
                    dataMap.get(monthKey)['Έξοδα'] += expense.amount || 0;
                }
            }
        });
    }

    return Array.from(dataMap.values());
  };
  
  const chartData = processData();
  
  const totalRevenue = chartData.reduce((sum, month) => sum + month['Έσοδα'], 0);
  const totalExpenses = chartData.reduce((sum, month) => sum + month['Έξοδα'], 0);
  const netProfit = totalRevenue - totalExpenses;

  if (isLoading) {
    // ... skeleton code ...
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-emerald-500"/>
            <span className="text-xl font-bold text-slate-900">Οικονομική Ροή (12 Μήνες)</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Καθαρό Κέρδος</p>
            <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              €{netProfit.toLocaleString('el-GR')}
            </p>
          </div>
        </CardTitle>
        <CardDescription>
          Σύνολο Εσόδων: €{totalRevenue.toLocaleString('el-GR')} • Σύνολο Εξόδων: €{totalExpenses.toLocaleString('el-GR')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `€${value/1000}k`}/>
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value) => `€${value.toLocaleString('el-GR')}`}
              />
              <Legend wrapperStyle={{fontSize: "14px"}}/>
              <Bar dataKey="Έσοδα" fill="url(#revenueGradient)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Έξοδα" fill="url(#expenseGradient)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.9}/>
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.9}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
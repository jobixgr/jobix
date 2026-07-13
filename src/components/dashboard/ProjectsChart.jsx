
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {TrendingUp} from "lucide-react";
import { format, subMonths, getMonth, getYear } from 'date-fns';
import { el } from 'date-fns/locale';

export default function ProjectsChart({ projects, isLoading }) {
  const processData = () => {
    const dataMap = new Map();
    const twelveMonthsAgo = subMonths(new Date(), 11);

    // Initialize last 12 months
    for (let i = 0; i < 12; i++) {
        const date = subMonths(new Date(), 11 - i);
        const monthKey = `${getYear(date)}-${getMonth(date)}`;
        const monthName = format(date, 'MMM', { locale: el });
        dataMap.set(monthKey, { name: monthName, 'Νέα Έργα': 0 });
    }

    if (projects) {
        projects.forEach(project => {
            const projectDate = new Date(project.created_date);
            if (projectDate >= twelveMonthsAgo) {
                const monthKey = `${getYear(projectDate)}-${getMonth(projectDate)}`;
                if (dataMap.has(monthKey)) {
                    dataMap.get(monthKey)['Νέα Έργα']++;
                }
            }
        });
    }

    return Array.from(dataMap.values());
  };
  
  const chartData = processData();

  if (isLoading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
        <CardHeader>
            <Skeleton className="h-6 w-48"/>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <TrendingUp className="w-5 h-5 text-blue-500"/>
            Δραστηριότητα Έργων (12 Μήνες)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false}/>
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
              />
              <Legend wrapperStyle={{fontSize: "14px"}}/>
              <Bar dataKey="Νέα Έργα" fill="url(#colorUv)" radius={[4, 4, 0, 0]} />
              <defs>
                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0052CC" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2684FF" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

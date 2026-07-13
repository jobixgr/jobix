import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Subscription() {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">Επιλέξτε το πλάνο σας</h1>
          <p className="text-lg text-slate-600">Ξεκλειδώστε όλες τις δυνατότητες του Jobix</p>
        </div>

        <Card className="max-w-md mx-auto bg-white/70 backdrop-blur-sm border-slate-200 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl gradient-text">Επαγγελματικό Πλάνο</CardTitle>
            <CardDescription className="text-slate-600">Όλα όσα χρειάζεστε για να απογειώσετε την επιχείρησή σας</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <span className="text-5xl font-bold text-slate-900">€19.99</span>
              <span className="text-slate-500">/ μήνα</span>
            </div>

            <ul className="space-y-3 text-slate-700">
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>Απεριόριστες Προσφορές</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>Απεριόριστα Έργα</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>Απεριόριστοι Πελάτες</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>Δημιουργία με AI</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>Υποστήριξη μέσω Email</span>
              </li>
            </ul>

            <Button className="w-full gradient-bg text-white py-3 text-lg" disabled>
              Η Ενσωμάτωση Πληρωμών έρχεται σύντομα!
            </Button>
            <p className="text-center text-xs text-slate-500">
              Ασφαλείς πληρωμές μέσω Stripe. Μπορείτε να ακυρώσετε οποιαδήποτε στιγμή.
            </p>
          </CardContent>
        </Card>
        
        <div className="text-center mt-8">
            <Link to={createPageUrl("Dashboard")}>
                <Button variant="link">Επιστροφή στο Dashboard</Button>
            </Link>
        </div>

      </div>
    </div>
  );
}
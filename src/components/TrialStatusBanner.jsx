import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Organization } from '@/api/entities';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createPageUrl } from '@/utils';
import { differenceInDays, addDays } from 'date-fns';
import { Info, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

const TRIAL_PERIOD_DAYS = 30;

export default function TrialStatusBanner() {
  const [trialDaysLeft, setTrialDaysLeft] = useState(TRIAL_PERIOD_DAYS);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('trialing');

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        const currentUser = await User.me();
        if (currentUser && currentUser.organization_id) {
          const org = await Organization.get(currentUser.organization_id);
          if (org && org.subscription_status === 'trialing' && org.trial_started_at) {
            const trialStartDate = new Date(org.trial_started_at);
            const trialEndDate = addDays(trialStartDate, TRIAL_PERIOD_DAYS);
            const daysLeft = differenceInDays(trialEndDate, new Date());
            setTrialDaysLeft(Math.max(0, daysLeft));
            setStatus('trialing');
          } else {
             setStatus(org.subscription_status || 'active'); // Assume active if not trialing
          }
        }
      } catch (error) {
        console.error("Error fetching trial status:", error);
        setStatus('error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrgData();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2">
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  
  if (status !== 'trialing') {
    return null; // Don't show banner if user is on a paid plan or trial is not applicable
  }
  
  if (trialDaysLeft > 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2">
        <Alert className="bg-blue-50 border-blue-200">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 font-semibold">
            Απομένουν {trialDaysLeft} {trialDaysLeft === 1 ? 'ημέρα' : 'ημέρες'} δωρεάν δοκιμής
          </AlertTitle>
          <div className="flex items-center justify-between">
            <AlertDescription className="text-blue-700">
              Αναβαθμίστε τώρα για να μην χάσετε καμία λειτουργία.
            </AlertDescription>
            <Link to={createPageUrl("Subscription")}>
              <Button size="sm" variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-100">
                Αναβάθμιση <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Alert>
      </div>
    );
  } else {
     return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-2">
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 font-bold">
            Η δωρεάν δοκιμή σας έχει λήξει!
          </AlertTitle>
          <div className="flex items-center justify-between">
            <AlertDescription className="text-red-700">
              Η πρόσβασή σας είναι περιορισμένη. Αναβαθμίστε για να συνεχίσετε να χρησιμοποιείτε όλες τις λειτουργίες.
            </AlertDescription>
            <Link to={createPageUrl("Subscription")}>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                Αναβάθμιση Τώρα
              </Button>
            </Link>
          </div>
        </Alert>
      </div>
    );
  }
}
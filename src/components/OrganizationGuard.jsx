import React, { useState, useEffect } from "react";
import { User } from "@/api/entities";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationGuard({ children, showBanner = true }) {
  const [hasOrganization, setHasOrganization] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOrganization();
  }, []);

  const checkOrganization = async () => {
    setIsLoading(true);
    try {
      const userData = await User.me();
      setHasOrganization(!!userData.organization_id);
    } catch (error) {
      console.error("Error checking organization:", error);
      setHasOrganization(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!hasOrganization && showBanner) {
    return (
      <div className="p-8">
        <Alert className="max-w-2xl mx-auto bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Απαιτείται Οργάνωση</AlertTitle>
          <AlertDescription className="text-amber-700 mb-4">
            Για να χρησιμοποιήσετε την εφαρμογή, πρέπει πρώτα να δημιουργήσετε ή να επιλέξετε μια οργάνωση.
          </AlertDescription>
          <Link to={createPageUrl("Settings")}>
            <Button className="gradient-bg text-white">
              <Settings className="w-4 h-4 mr-2" />
              Μετάβαση στις Ρυθμίσεις
            </Button>
          </Link>
        </Alert>
      </div>
    );
  }

  return children;
}
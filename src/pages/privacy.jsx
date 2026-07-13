
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ArrowLeft, Shield, Lock, Users, Mail } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="gradient-bg w-10 h-10 rounded-lg flex items-center justify-center mr-3">
                <Building2 className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold gradient-text">Jobix</span>
            </div>
            <Link to={createPageUrl("index")}>
              <Button variant="outline" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Αρχική
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Πολιτική Απορρήτου
          </h1>
          <p className="text-lg text-slate-600">
            Η δέσμευσή μας για την προστασία των δεδομένων σας
          </p>
        </div>

        {/* Privacy Policy Content */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl">
              <Shield className="w-6 h-6 text-indigo-600" />
              Η Δέσμευσή μας
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="prose prose-slate max-w-none">
              <p className="text-lg text-slate-700 leading-relaxed">
                Η εφαρμογή <strong>Jobix</strong> σέβεται την ιδιωτικότητα των χρηστών.
              </p>
            </div>

            {/* Data Collection */}
            <div className="border-l-4 border-indigo-500 pl-6 bg-indigo-50/50 py-4 rounded-r-lg">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-slate-900">Συλλογή Δεδομένων</h3>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Δεν συλλέγουμε προσωπικά δεδομένα πέρα από όσα εισάγουν οι ίδιοι οι χρήστες 
                (πελάτες, προσφορές, τιμολόγια).
              </p>
            </div>

            {/* Data Usage */}
            <div className="border-l-4 border-emerald-500 pl-6 bg-emerald-50/50 py-4 rounded-r-lg">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-slate-900">Χρήση Δεδομένων</h3>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Τα δεδομένα χρησιμοποιούνται μόνο για τη λειτουργία της εφαρμογής και 
                δεν κοινοποιούνται σε τρίτους.
              </p>
            </div>

            {/* Security */}
            <div className="border-l-4 border-amber-500 pl-6 bg-amber-50/50 py-4 rounded-r-lg">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-semibold text-slate-900">Ασφάλεια</h3>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Λαμβάνονται μέτρα ασφάλειας για την προστασία των δεδομένων.
              </p>
            </div>

            {/* Contact */}
            <div className="border-l-4 border-purple-500 pl-6 bg-purple-50/50 py-4 rounded-r-lg">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-900">Επικοινωνία</h3>
              </div>
              <p className="text-slate-700 leading-relaxed">
                Για ερωτήσεις επικοινωνήστε στο{' '}
                <a 
                  href="mailto:papado_kos@yahoo.gr" 
                  className="text-purple-600 hover:text-purple-700 font-medium underline decoration-purple-300 hover:decoration-purple-500 transition-colors"
                >
                  papado_kos@yahoo.gr
                </a>
              </p>
            </div>

            {/* Last Updated */}
            <div className="text-center pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                <strong>Τελευταία ενημέρωση:</strong> Σεπτέμβριος 2025
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-8">
          <Link to={createPageUrl("index")}>
            <Button className="gradient-bg text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Επιστροφή στην Αρχική
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/80 border-t border-slate-200 py-8 px-4 mt-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="gradient-bg w-8 h-8 rounded-lg flex items-center justify-center mr-2">
              <Building2 className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-bold gradient-text">Jobix</span>
          </div>
          <p className="text-slate-600 text-sm">
            © 2024 Jobix. Όλα τα δικαιώματα κατοχυρωμένα.
          </p>
        </div>
      </footer>

      <style>{`
        .gradient-bg {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }
        .gradient-text {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
    </div>
  );
}

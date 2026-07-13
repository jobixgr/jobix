
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User } from '@/api/entities';
import { createPageUrl } from '@/utils';
import {
  FileText,
  Users,
  CreditCard,
  BarChart3,
  ArrowRight,
  Loader2,
  CheckCircle,
  FolderKanban
} from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);
  const [isLoadingSignup, setIsLoadingSignup] = useState(false);

  // Αν ο χρήστης είναι ήδη συνδεδεμένος, πήγαινε κατευθείαν στο Dashboard.
  useEffect(() => {
    User.me()
      .then(() => { window.location.href = createPageUrl('Dashboard'); })
      .catch(() => { /* μη συνδεδεμένος — μένουμε στη landing */ });
  }, []);

  const handleLogin = () => {
    setIsLoadingLogin(true);
    navigate('/login?next=' + encodeURIComponent(createPageUrl('Dashboard')));
  };

  const handleSignup = () => {
    setIsLoadingSignup(true);
    navigate('/login?mode=register&next=' + encodeURIComponent(createPageUrl('Onboarding')));
  };

  const features = [
    {
      icon: <FileText className="w-8 h-8 text-blue-500" />,
      title: "Προσφορές & Τιμολόγια",
      description: "Δημιουργήστε επαγγελματικές προσφορές και τιμολόγια σε λεπτά."
    },
    {
      icon: <Users className="w-8 h-8 text-indigo-500" />,
      title: "Διαχείριση Πελατών",
      description: "Οργανώστε τους πελάτες σας και παρακολουθήστε το ιστορικό τους."
    },
    {
      icon: <CreditCard className="w-8 h-8 text-emerald-500" />,
      title: "Πληρωμές & Έξοδα",
      description: "Παρακολουθήστε τις πληρωμές, διαχειριστείτε τις οφειλές και τα έξοδα."
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-amber-500" />,
      title: "Αναφορές & Στατιστικά",
      description: "Δείτε τα κέρδη σας και αναλύστε την πορεία της επιχείρησης."
    }
  ];

  const benefits = [
    "Χωρίς δέσμευση",
    "Υποστήριξη 24/7",
    "Εύκολη εγκατάσταση",
    "Ασφαλή δεδομένα"
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-xl font-bold text-white">J</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800">
                Jobix
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={handleLogin}
                disabled={isLoadingLogin || isLoadingSignup}
                className="text-slate-600 hover:text-blue-600 hidden sm:flex"
              >
                {isLoadingLogin ? <Loader2 className="w-4 h-4 animate-spin" /> : "Σύνδεση"}
              </Button>
               <Button
                  onClick={handleSignup}
                  disabled={isLoadingLogin || isLoadingSignup}
                  className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {isLoadingSignup ? <Loader2 className="w-4 h-4 animate-spin" /> : "Δωρεάν Δοκιμή"}
                </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="relative py-24 lg:py-32 overflow-hidden bg-white">
           <div className="absolute inset-0 z-0 opacity-10">
              <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl animate-blob"></div>
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl animate-blob animation-delay-2000"></div>
              <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-2xl animate-blob animation-delay-4000"></div>
            </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
              <div className="lg:col-span-6 text-center lg:text-left">
                <Badge className="bg-blue-100 text-blue-800 px-3 py-1.5 text-sm font-semibold rounded-full mb-4">
                  Νέο: Δωρεάν δοκιμή για 1 μήνα! 🚀
                </Badge>
                <h2 className="text-4xl lg:text-6xl font-extrabold text-slate-900 mb-6 leading-tight tracking-tight">
                  Το απόλυτο εργαλείο για
                  <span className="block bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">μάστορες & τεχνίτες</span>
                </h2>
                <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                  Διαχειρίσου πελάτες, προσφορές και τιμολόγια εύκολα, όλα σε ένα μέρος.
                  Γίνε πιο επαγγελματίας και αύξησε τα κέρδη σου.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center lg:justify-start">
                  <Button
                    size="lg"
                    onClick={handleSignup}
                    disabled={isLoadingSignup || isLoadingLogin}
                    className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    {isLoadingSignup ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="w-5 h-5 mr-2" />
                    )}
                    Ξεκινήστε δωρεάν δοκιμή για 1 μήνα
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleLogin}
                    disabled={isLoadingLogin || isLoadingSignup}
                    className="px-8 py-3 text-lg font-semibold rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-300"
                  >
                    {isLoadingLogin ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Έχω ήδη λογαριασμό"
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-4 justify-center lg:justify-start text-sm">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                      <span className="text-slate-600">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 lg:mt-0 lg:col-span-6">
                <div className="relative">
                  <Card className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-2xl -rotate-2 transform hover:rotate-0 transition-transform duration-500 border border-blue-200">
                    {/* Demo Dashboard */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-4 min-h-[400px]">
                      {/* Dashboard Header */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <h3 className="text-lg font-bold text-slate-800">Dashboard</h3>
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        </div>
                      </div>

                      {/* Stats Cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-slate-500">Ενεργά Έργα</p>
                              <p className="text-xl font-bold text-slate-800">12</p>
                            </div>
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FolderKanban className="w-4 h-4 text-blue-600" />
                            </div>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-slate-500">Προσφορές</p>
                              <p className="text-xl font-bold text-slate-800">8</p>
                            </div>
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-indigo-600" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chart Area */}
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">Μηνιαία Έσοδα</h4>
                        <div className="flex items-end space-x-1 h-16">
                          <div className="bg-blue-200 w-4 h-6 rounded-t"></div>
                          <div className="bg-blue-300 w-4 h-10 rounded-t"></div>
                          <div className="bg-blue-400 w-4 h-8 rounded-t"></div>
                          <div className="bg-blue-500 w-4 h-12 rounded-t"></div>
                          <div className="bg-indigo-400 w-4 h-16 rounded-t"></div>
                          <div className="bg-indigo-500 w-4 h-14 rounded-t"></div>
                          <div className="bg-indigo-600 w-4 h-10 rounded-t"></div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">€15,240 αυτόν τον μήνα</p>
                      </div>

                      {/* Recent Projects */}
                      <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-800 mb-3">Πρόσφατα Έργα</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-slate-700">Ανακαίνιση Κουζίνας</span>
                            </div>
                            <span className="text-xs text-slate-500">€2,400</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-xs text-slate-700">Υδραυλικά Μπάνιου</span>
                            </div>
                            <span className="text-xs text-slate-500">€850</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-xs text-slate-700">Επισκευή Στέγης</span>
                            </div>
                            <span className="text-xs text-slate-500">€1,200</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
                Όλα όσα χρειάζεστε σε ένα εργαλείο
              </h3>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Απλοποιήστε τη διαχείριση της δουλειάς σας με εργαλεία σχεδιασμένα ειδικά για μάστορες.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 group hover:-translate-y-2">
                  <CardContent className="p-0">
                    <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors duration-300">
                      {/* Feature icon directly uses color specified in features array, no need for cloneElement replace logic */}
                      {feature.icon}
                    </div>
                    <h4 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-white">J</span>
              </div>
              <h3 className="text-3xl font-bold">Jobix</h3>
            </div>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Το καλύτερο εργαλείο για μάστορες και τεχνίτες που θέλουν να οργανώσουν και να αναπτύξουν την επιχείρησή τους.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button
                size="lg"
                onClick={handleSignup}
                disabled={isLoadingSignup || isLoadingLogin}
                className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoadingSignup ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-5 h-5 mr-2" />
                )}
                Ξεκίνα τώρα δωρεάν
              </Button>
            </div>
            <div className="border-t border-slate-800 pt-8">
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <p className="text-slate-400 text-sm">© 2026 Jobix. Όλα τα δικαιώματα διατηρούνται.</p>
                {/* Using <a> tag as Link component is not imported and context does not specify react-router-dom */}
                <a href={createPageUrl("privacy")} className="text-slate-400 hover:text-white transition-colors text-sm">
                  Πολιτική Απορρήτου
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

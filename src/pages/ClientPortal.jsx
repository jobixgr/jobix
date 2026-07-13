
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

import { 
  Shield, 
  FolderKanban, 
  Receipt, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Euro,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Eye,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const statusColors = {
  planned: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-700", 
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  canceled: "bg-red-100 text-red-700"
};

const statusLabels = {
  planned: "Σχεδιασμός",
  active: "Ενεργό",
  on_hold: "Σε Αναμονή", 
  completed: "Ολοκληρωμένο",
  canceled: "Ακυρωμένο"
};

export default function ClientPortal() {
  const [accessToken, setAccessToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [files, setFiles] = useState([]);
  const { toast } = useToast();

  const handleLogin = useCallback(async (token = null) => {
    const loginToken = token || accessToken;
    if (!loginToken.trim()) {
      toast({ title: "Σφάλμα", description: "Παρακαλώ εισάγετε τον κωδικό πρόσβασης.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Όλος ο έλεγχος του token και το φιλτράρισμα των δεδομένων γίνεται
      // πλέον server-side, ώστε ο πελάτης να βλέπει ΜΟΝΟ τα δικά του δεδομένα.
      const { portalLogin } = await import('@/api/functions');
      const data = await portalLogin(loginToken);

      setClient(data.client);
      setProjects(data.projects);
      setInvoices(data.invoices);
      setFiles(data.files);
      setIsAuthenticated(true);

    } catch (error) {
      console.error('Client portal login error:', error);
      toast({ title: "Σφάλμα", description: error.message || "Αποτυχία σύνδεσης. Παρακαλώ δοκιμάστε ξανά.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [accessToken, toast]);

  // Check URL for token on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setAccessToken(token);
      handleLogin(token);
    }
  }, [handleLogin]);

  const handleFileDownload = (file) => {
    window.open(file.url, '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">J</span>
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Πύλη Πελατών</CardTitle>
            <p className="text-sm text-slate-600">Εισάγετε τον κωδικό πρόσβασης που λάβατε</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Κωδικός Πρόσβασης</label>
              <Input
                type="text"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Εισάγετε τον κωδικό σας..."
                className="text-center"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button 
              onClick={() => handleLogin()} 
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              Σύνδεση
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">J</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Πύλη Πελατών</h1>
              <p className="text-sm text-slate-600">Καλώς ήρθατε, {client?.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Τελευταία σύνδεση</p>
            <p className="text-sm font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: el })}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Welcome Section */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Στοιχεία Επικοινωνίας
                </h2>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2"><User className="w-4 h-4" /> {client?.name}</p>
                  {client?.company && <p className="flex items-center gap-2"><User className="w-4 h-4" /> {client.company}</p>}
                  {client?.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {client.email}</p>}
                  {client?.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> {client.phone}</p>}
                  {client?.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {client.address}</p>}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">Επισκόπηση</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{projects.length}</p>
                    <p className="text-sm text-blue-700">Έργα</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{invoices.length}</p>
                    <p className="text-sm text-emerald-700">Τιμολόγια</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/50 backdrop-blur-sm">
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4" />
              Έργα
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Τιμολόγια
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Αρχεία
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            <div className="grid gap-4">
              {projects.length === 0 ? (
                <Card className="bg-white/70 backdrop-blur-sm">
                  <CardContent className="text-center py-12">
                    <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Δεν υπάρχουν έργα προς εμφάνιση.</p>
                  </CardContent>
                </Card>
              ) : (
                projects.map(project => (
                  <Card key={project.id} className="bg-white/70 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{project.title}</h3>
                          <p className="text-sm text-slate-600">{project.description}</p>
                        </div>
                        <Badge className={statusColors[project.status]}>
                          {statusLabels[project.status]}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {project.start_date && (
                          <div>
                            <p className="text-slate-500">Έναρξη</p>
                            <p className="font-medium">{format(new Date(project.start_date), 'dd/MM/yyyy', { locale: el })}</p>
                          </div>
                        )}
                        {project.end_date && (
                          <div>
                            <p className="text-slate-500">Λήξη</p>
                            <p className="font-medium">{format(new Date(project.end_date), 'dd/MM/yyyy', { locale: el })}</p>
                          </div>
                        )}
                        {project.budget_total && (
                          <div>
                            <p className="text-slate-500">Προϋπολογισμός</p>
                            <p className="font-medium text-emerald-600">€{project.budget_total.toLocaleString('el-GR')}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="invoices">
            <div className="grid gap-4">
              {invoices.length === 0 ? (
                <Card className="bg-white/70 backdrop-blur-sm">
                  <CardContent className="text-center py-12">
                    <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Δεν υπάρχουν τιμολόγια προς εμφάνιση.</p>
                  </CardContent>
                </Card>
              ) : (
                invoices.map(invoice => (
                  <Card key={invoice.id} className="bg-white/70 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-slate-900">#{invoice.number}</h3>
                            <Badge className={
                              invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }>
                              {invoice.status === 'paid' ? 'Πληρωμένο' :
                               invoice.status === 'overdue' ? 'Εκπρόθεσμο' : 'Εκκρεμές'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Ημερομηνία</p>
                              <p className="font-medium">{format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: el })}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Ποσό</p>
                              <p className="font-bold text-lg text-slate-900">€{invoice.total.toLocaleString('el-GR')}</p>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          Προβολή
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="files">
            <div className="grid gap-4">
              {files.length === 0 ? (
                <Card className="bg-white/70 backdrop-blur-sm">
                  <CardContent className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Δεν υπάρχουν αρχεία διαθέσιμα.</p>
                  </CardContent>
                </Card>
              ) : (
                files.map(file => (
                  <Card key={file.id} className="bg-white/70 backdrop-blur-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-slate-400" />
                          <div>
                            <h4 className="font-medium text-slate-900">{file.name}</h4>
                            <p className="text-sm text-slate-500">
                              {format(new Date(file.created_date), 'dd/MM/yyyy HH:mm', { locale: el })}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleFileDownload(file)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Κατέβασμα
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

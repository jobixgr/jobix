
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Calendar, 
  Euro,
  ArrowRight,
  Clock,
  CheckCircle2,
  MoreVertical,
  XCircle,
  Trash2,
  Ban,
  AlertTriangle
} from "lucide-react";
import { Project, User, Payment } from "@/api/entities";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/components/ui/use-toast';

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

const statusIcons = {
  planned: Clock,
  active: FolderKanban,
  on_hold: Clock,
  completed: CheckCircle2,
  canceled: XCircle
};

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [projectsWithFinancials, setProjectsWithFinancials] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [projectToComplete, setProjectToComplete] = useState(null);
  const [projectToCancel, setProjectToCancel] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser?.organization_id) {
        setProjects([]);
        setProjectsWithFinancials([]);
        setIsLoading(false);
        return;
      }
      
      const projectsData = await Project.filter({ organization_id: currentUser.organization_id }, '-updated_date');
      setProjects(projectsData);

      // Load financial data for each project
      const projectsWithFinancialsData = await Promise.all(
        projectsData.map(async (project) => {
          try {
            const payments = await Payment.filter({ project_id: project.id });
            
            const totalPaid = payments
              .filter(p => p.status === 'paid')
              .reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const totalPending = payments
              .filter(p => p.status === 'pending' || p.status === 'overdue')
              .reduce((sum, p) => sum + (p.amount || 0), 0);

            const totalProjectValue = project.budget_total || 0;
            const remaining = totalProjectValue - totalPaid;
            const paidPercentage = totalProjectValue > 0 ? (totalPaid / totalProjectValue) * 100 : 0;

            // Find advance payment (usually the first payment or one with specific title)
            const advancePayment = payments
              .filter(p => p.status === 'paid')
              .find(p => 
                p.title?.toLowerCase().includes('προκαταβολή') || 
                p.title?.toLowerCase().includes('advance') ||
                // Check if it's the first *paid* payment if no specific title match
                (payments.indexOf(p) === payments.findIndex(payment => payment.status === 'paid'))
              );

            return {
              ...project,
              financials: {
                totalPaid,
                totalPending,
                remaining,
                paidPercentage,
                advanceAmount: advancePayment?.amount || 0,
                hasAdvance: !!advancePayment,
                totalValue: totalProjectValue
              }
            };
          } catch (error) {
            console.error(`Error loading financials for project ${project.id}:`, error);
            return {
              ...project,
              financials: {
                totalPaid: 0,
                totalPending: 0,
                remaining: project.budget_total || 0,
                paidPercentage: 0,
                advanceAmount: 0,
                hasAdvance: false,
                totalValue: project.budget_total || 0
              }
            };
          }
        })
      );

      setProjectsWithFinancials(projectsWithFinancialsData);
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
      setProjectsWithFinancials([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let filtered = projectsWithFinancials;
    
    if (searchQuery) {
      filtered = filtered.filter(project => 
        project.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(project => project.status === statusFilter);
    }
    
    setFilteredProjects(filtered);
  }, [projectsWithFinancials, searchQuery, statusFilter]);

  const handleCompleteProject = async (projectId) => {
    try {
      await Project.update(projectId, { 
        status: 'completed',
        end_date: new Date().toISOString().split('T')[0]
      });
      
      toast({
        title: "Επιτυχία!",
        description: "Το έργο ολοκληρώθηκε και μεταφέρθηκε στο ιστορικό."
      });
      
      loadProjects();
    } catch (error) {
      console.error("Error completing project:", error);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία ολοκλήρωσης έργου.",
        variant: "destructive"
      });
    }
  };

  const handleCancelProject = async (projectId) => {
    try {
      await Project.update(projectId, { 
        status: 'canceled',
        end_date: new Date().toISOString().split('T')[0]
      });
      
      toast({
        title: "Επιτυχία!",
        description: "Το έργο ακυρώθηκε."
      });
      
      loadProjects();
    } catch (error) {
      console.error("Error canceling project:", error);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία ακύρωσης έργου.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await Project.delete(projectId);
      
      toast({
        title: "Επιτυχία!",
        description: "Το έργο διαγράφηκε."
      });
      
      loadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast({
        title: "Σφάλμα",
        description: "Αποτυχία διαγραφής έργου.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Έργα</h1>
            <p className="text-sm md:text-base text-slate-600">Διαχειρίσου όλα τα έργα σου και παρακολούθησε την πρόοδό τους</p>
          </div>
          <Link to={createPageUrl("ProjectNew")}>
            <Button className="gradient-bg text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full md:w-auto">
              <Plus className="w-4 md:w-5 h-4 md:h-5 mr-2" />
              <span className="text-sm md:text-base">Νέο Έργο</span>
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="w-4 md:w-5 h-4 md:h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <Input
                  placeholder="Αναζήτηση έργων..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200 text-sm md:text-base"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "all", label: "Όλα" },
                  { value: "active", label: "Ενεργά" },
                  { value: "planned", label: "Σχεδιασμός" },
                  { value: "on_hold", label: "Σε Αναμονή" },
                  { value: "completed", label: "Ολοκληρωμένα" },
                  { value: "canceled", label: "Ακυρωμένα" }
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={statusFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`text-xs md:text-sm ${statusFilter === filter.value ? "gradient-bg text-white" : ""}`}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-6 bg-slate-200 rounded w-16"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                  <div className="mt-4 flex justify-between">
                    <div className="h-4 bg-slate-200 rounded w-20"></div>
                    <div className="h-4 bg-slate-200 rounded w-16"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FolderKanban className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg md:text-xl font-semibold text-slate-600 mb-2">
                {searchQuery || statusFilter !== "all" ? "Δεν βρέθηκαν έργα" : "Δεν υπάρχουν έργα ακόμα"}
              </h3>
              <p className="text-sm md:text-base text-slate-500 mb-6">
                {searchQuery || statusFilter !== "all" 
                  ? "Δοκίμασε να αλλάξεις τα φίλτρα αναζήτησης"
                  : "Ξεκίνα δημιουργώντας το πρώτο σου έργο"
                }
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Link to={createPageUrl("ProjectNew")}>
                  <Button className="gradient-bg text-white px-4 md:px-6 py-2 md:py-3 w-full md:w-auto">
                    <Plus className="w-5 h-5 mr-2" />
                    Δημιούργησε Έργο
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const StatusIcon = statusIcons[project.status];
              const financials = project.financials || {};
              return (
                <div key={project.id} className="relative group">
                  <Link
                    to={createPageUrl("ProjectView") + `?id=${project.id}`}
                    className="block"
                  >
                    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
                      <CardContent className="p-6 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              project.status === 'completed' ? 'bg-emerald-100' :
                              project.status === 'active' ? 'bg-blue-100' :
                              project.status === 'on_hold' ? 'bg-yellow-100' :
                              project.status === 'canceled' ? 'bg-red-100' :
                              'bg-slate-100'
                            }`}>
                              <StatusIcon className={`w-5 h-5 ${
                                project.status === 'completed' ? 'text-emerald-600' :
                                project.status === 'active' ? 'text-blue-600' :
                                project.status === 'on_hold' ? 'text-yellow-600' :
                                project.status === 'canceled' ? 'text-red-600' :
                                'text-slate-600'
                              }`} />
                            </div>
                            <Badge className={statusColors[project.status]}>
                              {statusLabels[project.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8" 
                                  onClick={(e) => e.preventDefault()}
                                >
                                  <MoreVertical className="w-4 h-4 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(project.status === 'active') && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setProjectToComplete(project);
                                    }}
                                    className="text-emerald-600"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Ολοκλήρωση Έργου
                                  </DropdownMenuItem>
                                )}
                                {(project.status === 'active' || project.status === 'planned' || project.status === 'on_hold') && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                        e.preventDefault();
                                        setProjectToCancel(project);
                                        }}
                                        className="text-orange-600"
                                    >
                                        <Ban className="w-4 h-4 mr-2" />
                                        Ακύρωση Έργου
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setProjectToDelete(project);
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Διαγραφή Έργου
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        <h3 className="font-bold text-slate-900 text-base md:text-lg mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
                          {project.title}
                        </h3>
                        
                        {project.description && (
                          <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                        
                        <div className="mt-auto space-y-4">
                            {/* Financial Information */}
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Συνολική Αξία:</span>
                                <span className="font-semibold text-slate-900">€{financials.totalValue?.toLocaleString('el-GR') || '0'}</span>
                              </div>
                              
                              {financials.hasAdvance && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Προκαταβολή:
                                  </span>
                                  <span className="font-semibold text-emerald-700">€{financials.advanceAmount?.toLocaleString('el-GR')}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Εισπραχθέντα:</span>
                                <span className="font-semibold text-blue-700">€{financials.totalPaid?.toLocaleString('el-GR') || '0'}</span>
                              </div>
                              
                              {financials.remaining > 0 && (
                                <div className="flex items-center justify-between text-sm">
                                  <span className={`flex items-center gap-1 text-amber-600`}>
                                    <AlertTriangle className="w-3 h-3" />
                                    Υπόλοιπο:
                                  </span>
                                  <span className={`font-semibold text-amber-700`}>
                                    €{financials.remaining?.toLocaleString('el-GR')}
                                  </span>
                                </div>
                              )}
                              
                              {/* Progress Bar */}
                              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    financials.paidPercentage >= 100 ? 'bg-emerald-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(financials.paidPercentage, 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>Είσπραξη: {financials.paidPercentage?.toFixed(0) || 0}%</span>
                                {financials.paidPercentage >= 100 && (
                                  <span className="text-emerald-600 font-medium">✓ Εξοφλημένο</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm text-slate-500">
                              {project.start_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {format(new Date(project.start_date), 'dd MMM yyyy', { locale: el })}
                                </div>
                              )}
                              {!financials.hasAdvance && financials.totalValue > 0 && (
                                <div className="flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span className="text-xs">Χωρίς προκαταβολή</span>
                                </div>
                              )}
                            </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })
          )}
        </div>

        {/* Complete Project Dialog */}
        <AlertDialog open={!!projectToComplete} onOpenChange={() => setProjectToComplete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ολοκλήρωση Έργου</AlertDialogTitle>
              <AlertDialogDescription>
                Είστε σίγουροι ότι θέλετε να ολοκληρώσετε το έργο "{projectToComplete?.title}"? 
                Το έργο θα μεταφερθεί στο ιστορικό και δεν θα εμφανίζεται πια στα ενεργά έργα.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Άκυρο</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleCompleteProject(projectToComplete.id);
                  setProjectToComplete(null);
                }}
                className="gradient-bg text-white"
              >
                Ολοκλήρωση Έργου
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Project Dialog */}
        <AlertDialog open={!!projectToCancel} onOpenChange={() => setProjectToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ακύρωση Έργου</AlertDialogTitle>
              <AlertDialogDescription>
                Είστε σίγουροι ότι θέλετε να ακυρώσετε το έργο "{projectToCancel?.title}"? 
                Το έργο θα μεταφερθεί στα ακυρωμένα έργα.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Άκυρο</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleCancelProject(projectToCancel.id);
                  setProjectToCancel(null);
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Ακύρωση Έργου
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Project Dialog */}
        <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Διαγραφή Έργου</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>
                    <strong>ΠΡΟΣΟΧΗ:</strong> Είστε σίγουροι ότι θέλετε να διαγράψετε το έργο "{projectToDelete?.title}";
                  </p>
                  <p className="text-red-600 font-semibold">
                    Αυτή η ενέργεια δεν μπορεί να αναιρεθεί και θα διαγραφούν:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>Όλες οι εργασίες του έργου</li>
                    <li>Όλα τα αρχεία του έργου</li>
                    <li>Όλες οι πληρωμές που σχετίζονται</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Άκυρο</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleDeleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Οριστική Διαγραφή
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

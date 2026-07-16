
import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Project,
  Client,
  Task,
  File as ProjectFile,
  Payment,
  Proposal,
  ProposalItem,
  User,
  Expense // Added Expense entity
} from "@/api/entities";
import { getProjectShareLink } from "@/api/functions";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Share2,
  FolderKanban,
  ListChecks,
  CreditCard,
  Paperclip,
  AlertCircle,
  Download,
  Receipt,
  User as UserIcon,
  Calendar,
  Euro,
  FileText,
  ListTodo,
  Wallet,
  CheckCircle2,
  Clock,
  Edit,
  Mail,
  Phone,
  KanbanSquare,
  Banknote // Replaced Tool with Banknote for expenses
} from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Skeleton } from '@/components/ui/skeleton';

import TasksKanban from "../components/projects/TasksKanban";
import TasksList from '../components/projects/TasksList';
import PaymentsDetail from "../components/projects/PaymentsDetail";
import FilesManager from "../components/projects/FilesManager";
import ExpensesDetail from "../components/projects/ExpensesDetail"; // Import new component

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

export default function ProjectView() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [project, setProject] = useState(null);
    const [client, setClient] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [payments, setPayments] = useState([]);
    const [expenses, setExpenses] = useState([]); // Add state for expenses
    const [files, setFiles] = useState([]);
    const [proposal, setProposal] = useState(null);
    const [proposalItems, setProposalItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
    const [activeTab, setActiveTab] = useState("details"); // Add state to track active tab

    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    const loadProject = useCallback(async () => {
        if (!projectId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const projectData = await Project.get(projectId);
            if (!projectData) {
                setProject(null);
                setIsLoading(false);
                toast({
                    title: "Σφάλμα Φόρτωσης",
                    description: "Το έργο δεν βρέθηκε ή δεν υπάρχει.",
                    variant: "destructive",
                });
                return;
            }

            setProject(projectData);

            const dataPromises = [
                Task.filter({ project_id: projectId }, 'order_index').catch(() => []),
                Payment.filter({ project_id: projectId }).catch(() => []),
                ProjectFile.filter({ project_id: projectId }).catch(() => []),
                Expense.filter({ project_id: projectId }).catch(() => [])
            ];

            // Handle client loading with proper error handling
            if (projectData.client_id) {
                dataPromises.push(
                    Client.get(projectData.client_id).catch((error) => {
                        console.warn('Client not found:', projectData.client_id, error);
                        toast({
                            title: "Προειδοποίηση",
                            description: "Τα στοιχεία του πελάτη δεν είναι διαθέσιμα (πιθανώς διαγράφηκαν).",
                            variant: "destructive",
                        });
                        return null;
                    })
                );
            } else {
                dataPromises.push(Promise.resolve(null));
            }

            // Handle proposal loading with proper error handling
            if (projectData.proposal_id) {
                dataPromises.push(
                    Proposal.get(projectData.proposal_id).catch((error) => {
                        console.warn('Proposal not found:', projectData.proposal_id, error);
                        return null;
                    })
                );
                dataPromises.push(
                    ProposalItem.filter({ proposal_id: projectData.proposal_id }).catch(() => [])
                );
            } else {
                dataPromises.push(Promise.resolve(null));
                dataPromises.push(Promise.resolve([]));
            }

            const [
                tasksResult,
                paymentsResult,
                filesResult,
                expensesResult,
                clientResult,
                proposalResult,
                proposalItemsResult
            ] = await Promise.all(dataPromises);

            setTasks(tasksResult || []);
            setPayments(paymentsResult || []);
            setFiles(filesResult || []);
            setExpenses(expensesResult || []);
            setClient(clientResult);
            setProposal(proposalResult);
            setProposalItems(proposalItemsResult || []);

        } catch (error) {
            console.error("Failed to load project:", error);
            setProject(null);
            toast({
                title: "Σφάλμα Φόρτωσης",
                description: "Δεν ήταν δυνατή η φόρτωση των δεδομένων του έργου.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [projectId, toast]);

    useEffect(() => {
        loadProject();
    }, [loadProject]);

    const updateTaskStatus = async (task, newStatus, newIndex) => {
        const originalTasks = [...tasks];
        const updatedTasks = tasks.map(t =>
          t.id === task.id ? { ...t, status: newStatus, order_index: newIndex } : t
        );
        setTasks(updatedTasks);

        try {
          await Task.update(task.id, { status: newStatus, order_index: newIndex });
          toast({ title: "Επιτυχία", description: `Η εργασία "${task.title}" ενημερώθηκε.` });
        } catch (error) {
          console.error('Error updating task status:', error);
          setTasks(originalTasks);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία ενημέρωσης της κατάστασης της εργασίας.",
            variant: "destructive",
          });
        }
    };

    const updateTaskOrder = async (source, destination) => {
        const originalTasks = [...tasks];
        const reorderedTasks = Array.from(tasks);
        const [movedTask] = reorderedTasks.splice(source.index, 1);
        reorderedTasks.splice(destination.index, 0, movedTask);

        const updatedTasksWithOrder = reorderedTasks.map((t, index) => ({...t, order_index: index}));
        setTasks(updatedTasksWithOrder);

        try {
            const tasksToUpdate = updatedTasksWithOrder.map(task => {
                if (task.id === movedTask.id && task.status !== destination.droppableId) {
                    return Task.update(task.id, { order_index: task.order_index, status: destination.droppableId });
                }
                return Task.update(task.id, { order_index: task.order_index });
            });
          await Promise.all(tasksToUpdate);
          toast({ title: "Επιτυχία", description: "Η σειρά των εργασιών ενημερώθηκε." });
        } catch (error) {
          console.error('Error updating task order:', error);
          setTasks(originalTasks);
          toast({
            title: "Σφάλμα",
            description: "Αποτυχία αλλαγής σειράς των εργασιών.",
            variant: "destructive",
          });
        }
    };

    const handleFileUpdate = () => {
        loadProject();
    };

    const handlePaymentUpdate = async (paymentId, updates) => {
        try {
            await Payment.update(paymentId, updates);
            toast({ title: "Επιτυχία", description: "Η πληρωμή ενημερώθηκε." });
            loadProject(); // This won't change the active tab anymore
        } catch (error) {
            console.error('Error updating payment:', error);
            toast({
                title: "Σφάλμα",
                description: "Αποτυχία ενημέρωσης της πληρωμής.",
                variant: "destructive",
            });
        }
    };

    const [isSharing, setIsSharing] = useState(false);

    const handleShare = async () => {
        if (!projectId || isSharing) return;
        setIsSharing(true);
        try {
            // Ο σύνδεσμος περιέχει τυχαίο token — ΟΧΙ το id του έργου.
            const { url } = await getProjectShareLink({ projectId });
            await navigator.clipboard.writeText(url);
            toast({ title: "Ο δημόσιος σύνδεσμος αντιγράφηκε!", description: url });
        } catch (e) {
            toast({
                title: "Σφάλμα",
                description: e.message || "Δεν ήταν δυνατή η δημιουργία συνδέσμου.",
                variant: "destructive",
            });
        } finally {
            setIsSharing(false);
        }
    };

    const handleDownloadProposalPdf = () => {
        if (!proposal || !client || proposalItems.length === 0) {
            toast({ title: "Σφάλμα", description: "Δεν βρέθηκαν τα δεδομένα της προσφοράς ή είναι ελλιπή.", variant: "destructive" });
            return;
        }

        const effectiveVatRate = (proposal.subtotal > 0 && proposal.vat_amount !== undefined && proposal.subtotal !== undefined)
                                ? (proposal.vat_amount / proposal.subtotal) * 100
                                : 0;

        const proposalHtml = `
            <!DOCTYPE html>
            <html lang="el">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Προσφορά - ${proposal.title}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; margin: 20mm; color: #333; }
                    h1, h2, h3 { color: #2c3e50; }
                    h1 { font-size: 24px; margin-bottom: 10px; }
                    h2 { font-size: 20px; margin-top: 20px; margin-bottom: 5px; }
                    h3 { font-size: 16px; margin-top: 15px; margin-bottom: 5px; }
                    p { margin-bottom: 5px; }
                    hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .total-section p { text-align: right; margin-bottom: 2px; }
                    .total-section strong { font-size: 18px; }
                </style>
            </head>
            <body>
                <h1>Προσφορά #${proposal.number}</h1>
                <h2>${proposal.title}</h2>
                <p><strong>Ημερομηνία:</strong> ${new Date(proposal.created_date).toLocaleDateString('el-GR')}</p>
                <p><strong>Πελάτης:</strong> ${client.name}</p>
                <p><strong>Διεύθυνση:</strong> ${client.address || 'N/A'}</p>
                <p><strong>Τηλέφωνο:</strong> ${client.phone || 'N/A'}</p>
                <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
                <hr />
                <h3>Ανάλυση Κόστου</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Περιγραφή</th>
                            <th style="width: 15%; text-align: center;">Ποσότητα</th>
                            <th style="width: 15%; text-align: right;">Τιμή Μον.</th>
                            <th style="width: 20%; text-align: right;">Σύνολο</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${proposalItems.map(item => `
                            <tr>
                                <td>${item.description}</td>
                                <td style="text-align: center;">${item.quantity || 0} ${item.unit || ''}</td>
                                <td style="text-align: right;">€${(item.unit_price || 0).toFixed(2)}</td>
                                <td style="text-align: right;">€${(item.line_total || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total-section">
                    <p>Υποσύνολο: €${(proposal.subtotal || 0).toFixed(2)}</p>
                    <p>ΦΠΑ (${effectiveVatRate.toFixed(0)}%): €${(proposal.vat_amount || 0).toFixed(2)}</p>
                    <p><strong>Γενικό Σύνολο: €${(proposal.total || 0).toFixed(2)}</strong></p>
                </div>
                ${proposal.notes ? `<hr/><h3>Σημειώσεις</h3><p>${proposal.notes.replace(/\n/g, '<br>')}</p>` : ''}
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({ title: "Σφάλμα", description: "Δεν ήταν δυνατή η δημιουργία νέου παραθύρου. Ελέγξτε τις ρυθμίσεις pop-up.", variant: "destructive" });
            return;
        }
        printWindow.document.write(proposalHtml);
        printWindow.document.close();
        printWindow.print();
    };

    const financialSummary = {
        total: project?.budget_total || 0,
        paid: payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0),
        get remaining() { return this.total - this.paid }
    };


    if (isLoading) {
        return (
            <div className="p-8 bg-slate-50 min-h-screen">
                <Skeleton className="h-10 w-1/4 mb-4" />
                <Skeleton className="h-8 w-1/2 mb-8" />
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="p-8 bg-slate-50 min-h-screen flex flex-col items-center justify-center text-center h-full">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-semibold text-slate-800">Δεν βρέθηκε έργο</h2>
                <p className="text-slate-500 mt-2 max-w-md">
                    Το έργο που αναζητάτε δεν υπάρχει ή δεν έχετε δικαίωμα πρόσβασης.
                </p>
                <Button asChild className="mt-6 gradient-bg text-white">
                    <Link to={createPageUrl("Projects")}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Επιστροφή στα Έργα
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate(createPageUrl('Projects'))} className="text-slate-600 pl-0">
                        <ArrowLeft className="w-4 h-4 mr-2"/>
                        Επιστροφή στα Έργα
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{project.title}</h1>
                        <div className="flex items-center gap-4 mt-2">
                            {project.status && (
                                <Badge className={`${statusColors[project.status]} text-base py-1 px-3`}>
                                    {statusLabels[project.status] || project.status}
                                </Badge>
                            )}
                            {client ? (
                                <span className="text-slate-500">Πελάτης: {client.name}</span>
                            ) : (
                                <span className="text-amber-600 text-sm">Πελάτης: Μη διαθέσιμος</span>
                            )}
                        </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-2 w-full md:w-auto">
                        <Link to={createPageUrl("ProjectEdit") + `?id=${projectId}`} className="flex-1 md:flex-none">
                            <Button variant="outline" className="w-full">
                                <Edit className="w-4 h-4 mr-2" />
                                Επεξεργασία
                            </Button>
                        </Link>
                        <Button onClick={handleShare} variant="outline" className="flex-1 md:flex-none">
                            <Share2 className="w-4 h-4 mr-2" />
                            Κοινοποίηση
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-slate-100">
                        <TabsTrigger value="details"><FolderKanban className="w-4 h-4 mr-2"/>Λεπτομέρειες</TabsTrigger>
                        <TabsTrigger value="tasks"><ListChecks className="w-4 h-4 mr-2"/>Εργασίες</TabsTrigger>
                        <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-2"/>Πληρωμές</TabsTrigger>
                        <TabsTrigger value="expenses"><Banknote className="w-4 h-4 mr-2"/>Έξοδα</TabsTrigger>
                        <TabsTrigger value="files"><Paperclip className="w-4 h-4 mr-2"/>Αρχεία</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details">
                        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                            <CardHeader><CardTitle>Πληροφορίες Έργου</CardTitle></CardHeader>
                            <CardContent className="space-y-4 text-slate-700">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <p className="text-lg font-semibold">{project.description}</p>
                                    <div>
                                        {project.status && (
                                            <Badge className={`${statusColors[project.status]} text-sm`}>
                                                {statusLabels[project.status] || project.status}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Calendar className="w-4 h-4"/> Ημερομηνίες</h3>
                                        <p>Έναρξη: {project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy', { locale: el }) : 'N/A'}</p>
                                        <p>Λήξη: {project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy', { locale: el }) : 'N/A'}</p>
                                        <p>Προθεσμία: {project.due_date ? format(new Date(project.due_date), 'dd/MM/yyyy', { locale: el }) : 'N/A'}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><UserIcon className="w-4 h-4"/> Στοιχεία Πελάτη</h3>
                                        {client ? (
                                            <>
                                                <p>Όνομα: {client.name}</p>
                                                <p className="flex items-center gap-2"><Mail className="w-4 h-4"/> Email: {client.email || 'N/A'}</p>
                                                <p className="flex items-center gap-2"><Phone className="w-4 h-4"/> Τηλέφωνο: {client.phone || 'N/A'}</p>
                                            </>
                                        ) : (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                <p className="text-amber-700 text-sm">⚠️ Τα στοιχεία του πελάτη δεν είναι διαθέσιμα</p>
                                                <p className="text-amber-600 text-xs mt-1">Ο πελάτης μπορεί να έχει διαγραφεί από το σύστημα</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Euro className="w-4 h-4"/> Οικονομικά Στοιχεία</h3>
                                        <p>Συνολικό Ποσό: €{(financialSummary.total || 0).toFixed(2)}</p>
                                        <p>Πληρωθέν: €{(financialSummary.paid || 0).toFixed(2)}</p>
                                        <p>Υπόλοιπο: €{(financialSummary.remaining || 0).toFixed(2)}</p>
                                        <Link to={createPageUrl("InvoiceNew") + `?project_id=${project.id}`}>
                                            <Button variant="outline" className="w-full md:w-auto mt-2">
                                                <Receipt className="w-4 h-4 mr-2" />
                                                Δημιουργία Τιμολογίου
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                                {proposal && (
                                    <Button onClick={handleDownloadProposalPdf} variant="outline" className="mt-4">
                                        <Download className="w-4 h-4 mr-2" />
                                        Λήψη PDF Προσφοράς
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="tasks">
                        <div className="flex justify-end mb-4 gap-2">
                            <Button
                                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                                onClick={() => setViewMode('kanban')}
                                className="flex items-center gap-1"
                            >
                                <KanbanSquare className="w-4 h-4" /> Kanban
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'default' : 'outline'}
                                onClick={() => setViewMode('list')}
                                className="flex items-center gap-1"
                            >
                                <ListTodo className="w-4 h-4" /> Λίστα
                            </Button>
                        </div>
                        {viewMode === 'kanban' ? (
                            <TasksKanban
                                tasks={tasks}
                                projectId={project.id}
                                onTaskStatusChange={updateTaskStatus}
                                onTaskOrderChange={updateTaskOrder}
                                reloadProjectData={loadProject}
                            />
                        ) : (
                            <TasksList
                                tasks={tasks}
                                projectId={project.id}
                                reloadProjectData={loadProject}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="payments">
                       <PaymentsDetail
                         project={project}
                         payments={payments}
                         expenses={expenses} // Pass expenses to PaymentsDetail
                         proposalItems={proposalItems}
                         onPaymentUpdate={handlePaymentUpdate}
                         reloadProjectData={loadProject}
                       />
                    </TabsContent>
                    <TabsContent value="expenses">
                        <ExpensesDetail
                            project={project}
                            expenses={expenses}
                            reloadProjectData={loadProject}
                        />
                    </TabsContent>
                    <TabsContent value="files">
                        <FilesManager
                          project={project}
                          files={files}
                          onFilesUpdate={handleFileUpdate}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

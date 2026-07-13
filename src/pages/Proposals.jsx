
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FileText,
  Plus,
  Search,
  Send,
  Check,
  X,
  Calendar,
  Euro,
  MoreVertical,
  Share2,
  Receipt,
  Copy,
  Eye,
  Trash2,
  Edit // Added Edit icon
} from "lucide-react";
import { Proposal, ProposalItem, ProposalLink, Invoice, InvoiceItem, Project, ProjectItem, Task, User, Payment } from "@/api/entities"; // Added Task entity, Added User, Added Payment
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { el } from "date-fns/locale";
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

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700"
};

const statusLabels = {
  draft: "Πρόχειρο",
  sent: "Στάλθηκε",
  accepted: "Έγινε Αποδεκτό",
  rejected: "Απορρίφθηκε"
};

const statusIcons = {
  draft: FileText,
  sent: Send,
  accepted: Check,
  rejected: X
};

export default function Proposals() {
  const [proposals, setProposals] = useState([]);
  const [filteredProposals, setFilteredProposals] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteProposalId, setDeleteProposalId] = useState(null);
  const [acceptProposalId, setAcceptProposalId] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser || !currentUser.organization_id) {
        toast({ title: "Σφάλμα", description: "Δεν βρέθηκε οργανισμός χρήστη.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const data = await Proposal.filter({ organization_id: currentUser.organization_id }, '-updated_date');
      // Φιλτράρω τις αποδεκτές προσφορές - δείχνω μόνο τις μη αποδεκτές
      const nonAcceptedProposals = data.filter(p => p.status !== 'accepted');
      setProposals(nonAcceptedProposals);
    } catch (error) {
      console.error('Error loading proposals:', error);
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης προσφορών.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    let filtered = proposals;

    if (searchQuery) {
      filtered = filtered.filter(proposal =>
        proposal.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proposal.number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(proposal => proposal.status === statusFilter);
    }

    setFilteredProposals(filtered);
  }, [proposals, searchQuery, statusFilter]);

  const handleViewProposal = (proposalId) => {
    navigate(createPageUrl("ProposalDetail") + "?id=" + proposalId);
  };

  const handleCopyPublicLink = async (proposalId) => {
    try {
      const existingLinks = await ProposalLink.filter({ proposal_id: proposalId });
      let token;

      if (existingLinks.length > 0) {
        token = existingLinks[0].token;
      } else {
        token = crypto.randomUUID();
        await ProposalLink.create({
          proposal_id: proposalId,
          token: token,
          expires_at: null
        });
      }

      const url = `${window.location.origin}${createPageUrl("ProposalPDF")}?token=${token}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Επιτυχία!", description: "Ο σύνδεσμος PDF αντιγράφηκε στο πρόχειρο." });
    } catch (error) {
      console.error("Error creating PDF link:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας συνδέσμου.", variant: "destructive" });
    }
  };

  const handleDeleteProposal = async (proposalId) => {
    try {
      // Delete proposal items first
      const items = await ProposalItem.filter({ proposal_id: proposalId });
      for (const item of items) {
        await ProposalItem.delete(item.id);
      }
      
      // Delete proposal links
      const links = await ProposalLink.filter({ proposal_id: proposalId });
      for (const link of links) {
        await ProposalLink.delete(link.id);
      }
      
      // Delete the proposal
      await Proposal.delete(proposalId);
      
      toast({ title: "Επιτυχία!", description: "Η προσφορά διαγράφηκε." });
      loadProposals(); // Refresh list
    } catch (error) {
      console.error("Error deleting proposal:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής προσφοράς.", variant: "destructive" });
    }
  };

  const handleAcceptProposal = async (proposal) => {
    try {
      console.log("Starting proposal acceptance process for:", proposal.id);
      
      // 1. Update proposal status to accepted
      await Proposal.update(proposal.id, { 
        status: 'accepted', 
        accepted_at: new Date().toISOString() 
      });
      console.log("✅ Proposal status updated");

      // 2. Create project from proposal
      const newProject = await Project.create({
        organization_id: proposal.organization_id,
        client_id: proposal.client_id,
        proposal_id: proposal.id,
        title: proposal.title,
        description: proposal.description || "Έργο βάσει προσφοράς",
        status: 'active', 
        start_date: new Date().toISOString().split('T')[0],
        budget_total: proposal.total,
        notes: `Δημιουργήθηκε από την προσφορά #${proposal.number}`
      });
      console.log("✅ Project created:", newProject.id);

      // 3. Get proposal items and create tasks for each one
      try {
        const proposalItems = await ProposalItem.filter({ proposal_id: proposal.id });
        if (proposalItems.length > 0) {
          console.log(`Creating ${proposalItems.length} tasks...`);
          const tasksToCreate = proposalItems.map(item => ({
            project_id: newProject.id,
            title: item.description,
            description: `${item.type === 'labor' ? '🔧 Εργασία' : '📦 Υλικό'} - Ποσότητα: ${item.quantity} ${item.unit || 'τεμ.'}, Τιμή: €${item.unit_price}`,
            status: 'todo',
            priority: 'medium'
          }));

          await Task.bulkCreate(tasksToCreate);
          console.log("✅ Tasks created");
        }
      } catch (taskError) {
        console.error("⚠️ Task creation failed (μη κρίσιμο):", taskError);
      }

      // 4. Create advance payment if exists
      if (proposal.has_advance && proposal.advance_amount > 0) {
          console.log("Creating advance payment:", proposal.advance_amount);
          try {
              const advancePayment = await Payment.create({
                  organization_id: proposal.organization_id,
                  project_id: newProject.id,
                  client_id: proposal.client_id,
                  title: `Προκαταβολή για ${proposal.title}`,
                  amount: proposal.advance_amount,
                  currency: proposal.currency || 'EUR',
                  due_date: proposal.advance_received_at || new Date().toISOString().split('T')[0],
                  status: 'paid', // Mark as paid since it was already received
                  paid_at: proposal.advance_received_at ? new Date(proposal.advance_received_at).toISOString() : new Date().toISOString(),
                  method: 'bank_transfer',
                  notes: `Προκαταβολή από προσφορά #${proposal.number}`
              });
              console.log("✅ Advance payment created:", advancePayment);
          } catch (advanceError) {
              console.error("❌ Failed to create advance payment:", advanceError);
          }
      }

      // 5. Create remaining payment if there's a balance
      const remainingAmount = proposal.total - (proposal.advance_amount || 0);
      if (remainingAmount > 0) {
          console.log("Creating remaining payment:", remainingAmount);
          try {
              const remainingPayment = await Payment.create({
                  organization_id: proposal.organization_id,
                  project_id: newProject.id,
                  client_id: proposal.client_id,
                  title: `Υπόλοιπο πληρωμή για ${proposal.title}`,
                  amount: remainingAmount,
                  currency: proposal.currency || 'EUR',
                  due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
                  status: 'pending',
                  notes: `Υπόλοιπο πληρωμή από προσφορά #${proposal.number}`
              });
              console.log("✅ Remaining payment created:", remainingPayment);
          } catch (remainingError) {
              console.error("❌ Failed to create remaining payment:", remainingError);
          }
      }

      const advanceText = proposal.has_advance ? ` (Προκαταβολή €${proposal.advance_amount} καταχωρήθηκε ως εισπραγμένη)` : '';
      toast({
          title: "Η προσφορά έγινε Έργο! 🎉",
          description: `Μεταφέρεστε στο νέο έργο "${proposal.title}". Θα το βρίσκετε πάντα στην ενότητα «Έργα».${advanceText}`
      });

      // 6. Refresh list
      loadProposals();

      // 7. Navigate to the new project (κρίσιμο — γίνεται ό,τι κι αν συνέβη με tasks/payments)
      setTimeout(() => {
        navigate(createPageUrl("ProjectView") + "?id=" + newProject.id);
      }, 1200);

    } catch (error) {
      console.error("❌ Error accepting proposal:", error);
      toast({ title: "Σφάλμα", description: `Αποτυχία αποδοχής προσφοράς: ${error.message}`, variant: "destructive" });
    }
  };

  const handleCreateInvoice = async (proposal) => {
    try {
      const propItems = await ProposalItem.filter({ proposal_id: proposal.id });

      const newInvoice = await Invoice.create({
          organization_id: proposal.organization_id,
          project_id: null,
          client_id: proposal.client_id,
          proposal_id: proposal.id,
          number: `INV-${proposal.number.replace('PRO-', '')}`,
          status: 'draft',
          subtotal: proposal.subtotal,
          vat_amount: proposal.vat_amount,
          total: proposal.total,
          currency: proposal.currency,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
          notes: `Βάσει της προσφοράς #${proposal.number}`
      });

      const newInvoiceItems = propItems.map(item => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          line_total: item.line_total
      }));

      if(newInvoiceItems.length > 0) {
        await InvoiceItem.bulkCreate(newInvoiceItems);
      }

      toast({ title: "Επιτυχία!", description: "Το τιμολόγιο δημιουργήθηκε." });
      navigate(createPageUrl("Invoices"));
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας τιμολογίου.", variant: "destructive" });
    }
  };

  return (
    <div className="p-3 md:p-8 space-y-4 md:space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4 mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-1 md:mb-2">Προσφορές</h1>
            <p className="text-xs md:text-sm lg:text-base text-slate-600">Διαχειρίσου τις προσφορές σου και παρακολούθησε την πρόοδό τους</p>
          </div>
          <Button 
            onClick={() => navigate(createPageUrl("ProposalNew"))}
            className="gradient-bg text-white px-3 md:px-6 py-2 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto"
          >
            <Plus className="w-3 md:w-4 lg:w-5 h-3 md:h-4 lg:h-5 mr-1 md:mr-2" />
            <span className="text-xs md:text-sm lg:text-base">Νέα Προσφορά</span>
          </Button>
        </div>

        {/* Filters - Αφαιρώ την επιλογή "Αποδεκτές" αφού δεν τις δείχνω πια */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-4 md:mb-6">
          <CardContent className="p-3 md:p-6">
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <Input
                  placeholder="Αναζήτηση προσφορών..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200 text-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  { value: "all", label: "Όλες" },
                  { value: "draft", label: "Πρόχειρα" },
                  { value: "sent", label: "Σταλμένες" },
                  { value: "rejected", label: "Απορρίφθηκε" }
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={statusFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(filter.value)}
                    className={`text-xs whitespace-nowrap ${statusFilter === filter.value ? "gradient-bg text-white" : ""}`}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proposals List */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardContent className="p-3 md:p-6">
            {isLoading ? (
              <div className="space-y-3 md:space-y-4">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center justify-between p-3 md:p-4 border border-slate-100 rounded-xl">
                      <div className="flex-1">
                        <div className="h-4 md:h-5 bg-slate-200 rounded w-32 md:w-48 mb-2"></div>
                        <div className="h-3 md:h-4 bg-slate-200 rounded w-24 md:w-32"></div>
                      </div>
                      <div className="h-5 md:h-6 bg-slate-200 rounded w-16 md:w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProposals.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <FileText className="w-12 md:w-16 h-12 md:h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-base md:text-lg lg:text-xl font-semibold text-slate-600 mb-2">
                  {searchQuery || statusFilter !== "all" ? "Δεν βρέθηκαν προσφορές" : "Δεν υπάρχουν ενεργές προσφορές"}
                </h3>
                <p className="text-xs md:text-sm lg:text-base text-slate-500 mb-4 md:mb-6 px-4">
                  {searchQuery || statusFilter !== "all"
                    ? "Δοκίμασε να αλλάξεις τα φίλτρα αναζήτησης"
                    : "Όλες οι προσφορές έχουν μετατραπεί σε έργα ή δημιούργησε νέα προσφορά"
                  }
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Button 
                    onClick={() => navigate(createPageUrl("ProposalNew"))}
                    className="gradient-bg text-white w-full md:w-auto"
                  >
                    <Plus className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                    <span className="text-xs md:text-sm lg:text-base">Δημιούργησε Προσφορά</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {filteredProposals.map((proposal) => {
                  const StatusIcon = statusIcons[proposal.status];
                  return (
                    <div
                      key={proposal.id}
                      className="flex items-center justify-between p-3 md:p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => handleViewProposal(proposal.id)}
                    >
                      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <div className={`w-8 md:w-10 lg:w-12 h-8 md:h-10 lg:h-12 rounded-xl flex items-center justify-center ${statusColors[proposal.status].replace('text-', 'bg-').replace('-700', '-100')}`}>
                            <StatusIcon className={`w-4 md:w-5 lg:w-6 h-4 md:h-5 lg:w-6 ${statusColors[proposal.status].replace('bg-', 'text-').replace('-100', '-700')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm md:text-base text-slate-900 mb-1 group-hover:text-purple-600 transition-colors truncate">
                            {proposal.title}
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 md:gap-4 text-xs md:text-sm text-slate-500">
                              <span className="font-medium">#{proposal.number}</span>
                              {proposal.created_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 md:w-4 h-3 md:h-4" />
                                  <span>{format(new Date(proposal.created_date), 'dd MMM yyyy', { locale: el })}</span>
                                </div>
                              )}
                              {proposal.total && (
                                <div className="flex items-center gap-1 font-semibold">
                                  <Euro className="w-3 md:w-4 h-3 md:h-4" />
                                  {proposal.total.toLocaleString('el-GR')}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 md:gap-3">
                        <Badge className={`${statusColors[proposal.status]} text-xs`}>
                          {statusLabels[proposal.status]}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 md:h-10 md:w-10" 
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 md:w-5 h-4 md:h-5 text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={(e) => {
                               e.stopPropagation();
                               handleViewProposal(proposal.id);
                             }}>
                                <Eye className="w-4 h-4 mr-2" />
                                Προβολή
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={(e) => {
                               e.stopPropagation();
                               navigate(createPageUrl("ProposalEdit") + "?id=" + proposal.id);
                             }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Επεξεργασία
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={(e) => {
                               e.stopPropagation();
                               handleCopyPublicLink(proposal.id);
                             }}>
                                <Copy className="w-4 h-4 mr-2" />
                                Αντιγραφή PDF Link
                             </DropdownMenuItem>
                             {(proposal.status === 'draft' || proposal.status === 'sent') && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setAcceptProposalId(proposal.id);
                                }} className="text-green-600">
                                    <Check className="w-4 h-4 mr-2" />
                                    Αποδοχή & Δημιουργία Έργου
                                </DropdownMenuItem>
                             )}
                              {/* Removed 'Create Invoice' option for accepted proposals as they are now filtered out */}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteProposalId(proposal.id);
                                }}
                                className="text-red-600"
                              >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Διαγραφή
                              </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteProposalId} onOpenChange={() => setDeleteProposalId(null)}>
          <AlertDialogContent className="mx-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Διαγραφή Προσφοράς</AlertDialogTitle>
              <AlertDialogDescription>
                Είστε σίγουροι ότι θέτε να διαγράψετε αυτή την προσφορά; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Άκυρο</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  handleDeleteProposal(deleteProposalId);
                  setDeleteProposalId(null);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Διαγραφή
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Accept Confirmation Dialog */}
        <AlertDialog open={!!acceptProposalId} onOpenChange={() => setAcceptProposalId(null)}>
          <AlertDialogContent className="mx-4">
            <AlertDialogHeader>
              <AlertDialogTitle>Αποδοχή Προσφοράς</AlertDialogTitle>
              <AlertDialogDescription>
                Η προσφορά θα γίνει αποδεκτή και θα δημιουργηθεί αυτόματα ένα νέο ενεργό έργο. Η προσφορά θα εξαφανιστεί από την λίστα και θα μεταβείτε στο νέο έργο. Θέτε να συνεχίσετε;
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Άκυρο</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const proposal = proposals.find(p => p.id === acceptProposalId);
                  if (proposal) {
                    handleAcceptProposal(proposal);
                  }
                  setAcceptProposalId(null);
                }}
                className="gradient-bg text-white"
              >
                Αποδοχή & Δημιουργία Έργου
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

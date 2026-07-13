
import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Proposal, ProposalItem, Client, ItemTemplate, Organization, User, ProposalLink } from "@/api/entities"; // Added ProposalLink
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save, Sparkles, BookCopy, Plus, Loader2, AlertCircle, Send } from "lucide-react"; // Added Send
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns'; // Import format for date formatting
import { el } from 'date-fns/locale'; // Import Greek locale

import ProposalForm from "../components/proposals/ProposalForm";
import ProposalItemsTable from "../components/proposals/ProposalItemsTable";
import TemplatesModal from "../components/proposals/TemplatesModal";
import AIProposalBuilder from "../components/proposals/AIProposalBuilder";
import NewClientDialog from "../components/proposals/NewClientDialog";

export default function ProposalNew() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [organization, setOrganization] = useState(null);
    const [user, setUser] = useState(null);
    const [clients, setClients] = useState([]);

    const [proposal, setProposal] = useState({
        title: "",
        client_id: "",
        number: "",
        valid_until: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0], // Valid for 15 days
        notes: "Σας ευχαριστούμε για την προτίμησή σας.",
        status: 'draft',
        has_advance: false,
        advance_amount: 0,
        advance_received_at: ""
    });
    const [items, setItems] = useState([]);

    const [isSaving, setIsSaving] = useState(false);
    const [showTemplatesModal, setShowTemplatesModal] = useState(false);
    const [showAIBuilder, setShowAIBuilder] = useState(false);
    const [showNewClientDialog, setShowNewClientDialog] = useState(false);

    const loadInitialData = useCallback(async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);

            if (!currentUser.organization_id) {
                toast({
                    title: "Απαιτείται Ενεργή Οργάνωση",
                    description: "Παρακαλώ επιλέξτε μια ενεργή οργάνωση από τις Ρυθμίσεις για να συνεχίσετε.",
                    variant: "destructive",
                    duration: 5000,
                });
                return;
            }

            const [activeOrganization, clientData] = await Promise.all([
                Organization.get(currentUser.organization_id),
                Client.filter({ organization_id: currentUser.organization_id }) || [] // ΚΡΙΣΙΜΗ ΑΛΛΑΓΗ: Φιλτράρω μόνο τους πελάτες της οργάνωσης
            ]);

            if (!activeOrganization) {
                toast({
                    title: "Απαιτείται Οργάνωση",
                    description: "Δεν βρέθηκε η ενεργή σας οργάνωση. Δημιούργησε/επέλεξε Οργάνωση από τις Ρυθμίσεις πρώτα.",
                    variant: "destructive"
                });
                return;
            }

            setOrganization(activeOrganization);
            setClients(clientData); // Τώρα θα είναι μόνο οι δικοί του πελάτες

            // Get client_id from URL params if provided
            const urlParams = new URLSearchParams(window.location.search);
            const clientIdFromUrl = urlParams.get('client_id');
            if (clientIdFromUrl) {
                // Ελέγχω ότι ο πελάτης ανήκει στην οργάνωση
                const validClient = clientData.find(c => c.id === clientIdFromUrl);
                if (validClient) {
                    setProposal(p => ({ ...p, client_id: clientIdFromUrl }));
                } else {
                    toast({
                        title: "Μη έγκυρος πελάτης",
                        description: "Ο πελάτης δεν ανήκει στην οργάνωσή σας.",
                        variant: "destructive"
                    });
                }
            }

            // Generate a new proposal number - φιλτράρω μόνο τις προσφορές της οργάνωσης
            const lastProposal = await Proposal.filter({ organization_id: currentUser.organization_id }, '-created_date', 1);
            const lastNumber = lastProposal[0]?.number ? parseInt(lastProposal[0].number.split('-').pop()) : 0;
            const newNumber = `PRO-${(lastNumber + 1).toString().padStart(4, '0')}`;
            setProposal(p => ({ ...p, number: newNumber }));

        } catch (error) {
            console.error("Error loading initial data:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης αρχικών δεδομένων.", variant: "destructive" });
        }
    }, [toast]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const handleSaveProposal = async (andNavigate = false, isSending = false) => { // Added isSending parameter
        setIsSaving(true);
        let newProposal = null; // Declare newProposal to be returned
        try {
            // Validation
            if (!proposal.client_id || !proposal.title) {
                toast({ title: "Ελλιπή Στοιχεία", description: "Επιλέξτε πελάτη και δώστε τίτλο.", variant: "destructive" });
                setIsSaving(false);
                return null; // Return null on error
            }

            if (!organization) {
                toast({ title: "Σφάλμα", description: "Δεν βρέθηκε οργανισμός.", variant: "destructive" });
                setIsSaving(false);
                return null;
            }

            // Validate advance amount
            if (proposal.has_advance && (!proposal.advance_amount || proposal.advance_amount <= 0)) {
                toast({ title: "Σφάλμα", description: "Παρακαλώ εισάγετε έγκυρο ποσό προκαταβολής.", variant: "destructive" });
                setIsSaving(false);
                return null;
            }

            // Calculate totals
            const totals = items.reduce((acc, item) => {
                if (!item.is_optional) {
                    const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
                    const vat = lineTotal * (item.vat_rate || 0) / 100;
                    acc.subtotal += lineTotal;
                    acc.vat_amount += vat;
                }
                return acc;
            }, { subtotal: 0, vat_amount: 0 });

            totals.total = totals.subtotal + totals.vat_amount;

            // Validate advance amount against total
            if (proposal.has_advance && proposal.advance_amount > totals.total) {
                toast({
                    title: "Σφάλμα",
                    description: `Η προκαταβολή (€${proposal.advance_amount}) δεν μπορεί να είναι μεγαλύτερη από το συνολικό ποσό (€${totals.total.toFixed(2)}).`,
                    variant: "destructive"
                });
                setIsSaving(false);
                return null;
            }

            // Create proposal
            newProposal = await Proposal.create({
                ...proposal,
                ...totals,
                organization_id: organization.id,
                status: isSending ? 'sent' : 'draft',
                sent_at: isSending ? new Date().toISOString() : null,
                advance_amount: proposal.has_advance ? proposal.advance_amount : 0,
                advance_received_at: proposal.has_advance && proposal.advance_received_at ? proposal.advance_received_at : null
            });

            // Create proposal items
            if (items.length > 0) {
                const itemsToCreate = items.map(item => ({
                    ...item,
                    proposal_id: newProposal.id,
                    line_total: (item.quantity || 0) * (item.unit_price || 0)
                }));
                await ProposalItem.bulkCreate(itemsToCreate);
            }

            const advanceText = proposal.has_advance ? ` (Προκαταβολή: €${proposal.advance_amount})` : '';
            toast({
                title: "Επιτυχία!",
                description: isSending
                    ? `Η προσφορά αποθηκεύτηκε και σημειώθηκε ως σταλμένη.${advanceText}`
                    : `Η προσφορά αποθηκεύτηκε ως πρόχειρο.${advanceText}`
            });

            if (andNavigate) {
                // Wait longer before navigation to ensure database consistency
                await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay
                navigate(createPageUrl('ProposalDetail') + "?id=" + newProposal.id);
            }

        } catch (error) {
            console.error("Error saving proposal:", error);
            toast({
                title: "Σφάλμα",
                description: "Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.",
                variant: "destructive"
            });
            newProposal = null; // Ensure newProposal is null on error
        }
        setIsSaving(false);
        return newProposal; // Return the created proposal
    };

    const handleSaveAndSend = async () => {
        const savedProposal = await handleSaveProposal(false, true);

        if (savedProposal) {
            const client = clients.find(c => c.id === savedProposal.client_id);
            if (!client || !client.email) {
                toast({
                    title: "Σφάλμα Email",
                    description: `Η προσφορά αποθηκεύτηκε, αλλά ο πελάτης "${client?.name || 'Άγνωστος'}" δεν έχει καταχωρημένο email. Παρακαλώ προσθέστε email για αποστολή.`,
                    variant: "destructive"
                });
                setTimeout(() => {
                    navigate(createPageUrl('ProposalDetail') + "?id=" + savedProposal.id);
                }, 1500);
                return;
            }

            try {
                const { sendProposalEmail } = await import("@/api/functions");

                toast({ title: "Αποστολή...", description: "Στέλνεται σύνδεσμος προσφοράς στον πελάτη..." });

                // Call the backend function WITHOUT the publicUrlBase
                await sendProposalEmail({
                  proposalId: savedProposal.id
                });

                toast({
                    title: "Επιτυχία! 🎉",
                    description: `Ένας σύνδεσμος στην προσφορά στάλθηκε στον ${client.name} στο ${client.email}`
                });

                setTimeout(() => {
                    navigate(createPageUrl('ProposalDetail') + "?id=" + savedProposal.id);
                }, 3000);

            } catch (error) {
                console.error("Error sending email:", error);
                const errorMessage = error.response?.data?.details || error.response?.data?.error || `Αποτυχία αποστολής: ${error.message}`;
                toast({
                    title: "Σφάλμα Αποστολής",
                    description: errorMessage,
                    variant: "destructive"
                });
            }
        }
    };

    const handleAddTemplates = (templatesToAdd) => {
        const newItems = templatesToAdd.map(t => ({
            id: `temp-${Date.now()}-${Math.random()}`,
            type: t.kind,
            description: t.title,
            quantity: 1,
            unit: t.default_unit,
            unit_price: t.default_price,
            vat_rate: t.vat_rate,
            is_optional: false,
            line_total: t.default_price,
        }));
        setItems(prev => [...prev, ...newItems]);
        setShowTemplatesModal(false);
    };

    const handleAIGeneratedItems = (generatedItems) => {
        const newItems = generatedItems.map(item => ({
            ...item,
            id: `ai-${Date.now()}-${Math.random()}`,
            is_optional: false,
            line_total: (item.quantity || 0) * (item.unit_price || 0),
        }));
        setItems(prev => [...prev, ...newItems]);
        setShowAIBuilder(false);
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <Link to={createPageUrl("Proposals")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
                            <ArrowLeft className="w-4 h-4" />
                            Επιστροφή στις Προσφορές
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Δημιουργία Νέας Προσφοράς</h1>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button onClick={() => handleSaveProposal(true)} disabled={isSaving || !organization} className="bg-slate-600 hover:bg-slate-700 text-white w-full md:w-auto">
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            <span className="text-sm md:text-base">Αποθήκευση ως Πρόχειρο</span>
                        </Button>
                    </div>
                </div>

                {!organization && (
                    <Alert className="mb-6 bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800">Απαιτείται Οργάνωση</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                            Δημιουργήσε/επέλεξε Οργάνωση από τις Ρυθμίσεις για να συνεχίσεις.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Main Form Card */}
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                    <CardContent className="p-4 md:p-6">
                        <ProposalForm
                            proposal={proposal}
                            setProposal={setProposal}
                            clients={clients}
                            onNewClient={() => setShowNewClientDialog(true)}
                        />

                        <div className="my-8 flex flex-col md:flex-row gap-3">
                            <Button variant="outline" onClick={() => setShowTemplatesModal(true)} className="w-full md:flex-1">
                                <BookCopy className="w-4 h-4 mr-2" />
                                Προσθήκη από Πρότυπα
                            </Button>
                            <Button onClick={() => setShowAIBuilder(true)} className="w-full md:flex-1 gradient-bg text-white">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Δημιουργία με AI
                            </Button>
                        </div>

                        <ProposalItemsTable items={items} setItems={setItems} />

                        <div className="mt-8 flex justify-end">
                            <Button onClick={handleSaveAndSend} disabled={isSaving || !organization} className="gradient-bg text-white px-6 md:px-8 py-2 md:py-3 text-sm md:text-base w-full md:w-auto">
                                <Send className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                                Ολοκλήρωση & Αποστολή
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TemplatesModal
                open={showTemplatesModal}
                onClose={() => setShowTemplatesModal(false)}
                onInsert={handleAddTemplates}
            />

            <AIProposalBuilder
                open={showAIBuilder}
                onClose={() => setShowAIBuilder(false)}
                onItemsGenerated={handleAIGeneratedItems}
            />

            <NewClientDialog
                open={showNewClientDialog}
                onClose={() => setShowNewClientDialog(false)}
                onClientCreated={(newClient) => {
                    const updatedClients = [...clients, newClient];
                    setClients(updatedClients);
                    setProposal(p => ({ ...p, client_id: newClient.id }));
                    setShowNewClientDialog(false);
                }}
            />
        </div>
    );
}

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Proposal, ProposalItem, Client, Organization, User, ProposalLink } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Save, Send, Loader2, AlertCircle, Mail } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import ProposalForm from "../components/proposals/ProposalForm";
import ProposalItemsTable from "../components/proposals/ProposalItemsTable";

export default function ProposalEdit() {
    // Get proposal ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const proposalId = urlParams.get('id');
    
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [proposal, setProposal] = useState(null);
    const [items, setItems] = useState([]);
    const [clients, setClients] = useState([]);
    const [organization, setOrganization] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        if (!proposalId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const [prop, clientData] = await Promise.all([
                Proposal.get(proposalId),
                Client.list()
            ]);

            if (!prop) {
                setProposal(null);
                setIsLoading(false);
                return;
            }

            setProposal(prop);
            setClients(clientData);

            const [proposalItems, orgData] = await Promise.all([
                ProposalItem.filter({ proposal_id: prop.id }),
                Organization.get(prop.organization_id).catch(() => null)
            ]);
            
            setItems(proposalItems);
            setOrganization(orgData);

        } catch (error) {
            console.error("Error loading proposal:", error);
            setProposal(null);
        } finally {
            setIsLoading(false);
        }
    }, [proposalId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSaveProposal = async (andSend = false) => {
        setIsSaving(true);
        try {
            if (!proposal.client_id || !proposal.title) {
                toast({ title: "Ελλιπή Στοιχεία", description: "Επιλέξτε πελάτη και δώστε τίτλο.", variant: "destructive" });
                setIsSaving(false);
                return;
            }

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
            
            const updateData = {
                ...proposal,
                ...totals,
                status: andSend ? 'sent' : proposal.status,
                sent_at: andSend ? new Date().toISOString() : proposal.sent_at,
            };
            
            // This is a simplified update. A more robust solution might involve transactions.
            await Proposal.update(proposalId, updateData);

            // Simple diffing: Delete all and recreate.
            const existingItems = await ProposalItem.filter({ proposal_id: proposalId });
            for (const item of existingItems) {
                await ProposalItem.delete(item.id);
            }

            if (items.length > 0) {
                const itemsToCreate = items.map(item => ({
                    ...item,
                    proposal_id: proposalId,
                    line_total: (item.quantity || 0) * (item.unit_price || 0)
                }));
                await ProposalItem.bulkCreate(itemsToCreate);
            }
            
            toast({ title: "Επιτυχία!", description: `Η προσφορά ενημερώθηκε.` });

            if (andSend) {
                const client = clients.find(c => c.id === proposal.client_id);
                if (!client) throw new Error("Client not found for sending email.");

                const existingLinks = await ProposalLink.filter({ proposal_id: proposal.id });
                let token = existingLinks.length > 0 ? existingLinks[0].token : crypto.randomUUID();
                if (existingLinks.length === 0) {
                    await ProposalLink.create({ proposal_id: proposal.id, token });
                }

                const publicPdfUrl = `${window.location.origin}${createPageUrl("ProposalPDF")}?token=${token}`;
                const subject = `Ενημερωμένη Προσφορά #${proposal.number} από ${organization.name}`;
                const body = `Αγαπητέ/ή ${client.name},\n\nΕπισυνάπτεται η ενημερωμένη προσφορά μας.\n\n${publicPdfUrl}\n\nΜε εκτίμηση,\n${organization.name}`;
                
                window.location.href = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.trim())}`;
            }
            
            setTimeout(() => navigate(createPageUrl('ProposalDetail') + "?id=" + proposalId), 500);

        } catch (error) {
            console.error("Error saving proposal:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.", variant: "destructive" });
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 flex justify-center items-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (!proposal) {
        return (
            <div className="p-4 md:p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-semibold text-slate-800">Δεν βρέθηκε προσφορά</h2>
                <p className="text-slate-500 mt-2 max-w-md">
                    Η προσφορά που θέλετε να επεξεργαστείτε δεν υπάρχει ή έχει διαγραφεί.
                </p>
                <Button asChild className="mt-6 gradient-bg text-white">
                    <Link to={createPageUrl("Proposals")}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Επιστροφή στις Προσφορές
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="p-3 md:p-8 space-y-4 md:space-y-6 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <Button 
                            onClick={() => navigate(createPageUrl("ProposalDetail") + "?id=" + proposalId)} 
                            variant="ghost" 
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2 p-0"
                        >
                           <ArrowLeft className="w-4 h-4"/>
                           Επιστροφή στην Προσφορά
                        </Button>
                        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900">Επεξεργασία Προσφοράς</h1>
                        <p className="text-slate-500">#{proposal?.number}</p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button onClick={() => handleSaveProposal(false)} disabled={isSaving} className="bg-slate-600 hover:bg-slate-700 text-white flex-1 md:flex-none">
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                            <span className="text-sm md:text-base">Αποθήκευση</span>
                        </Button>
                        <Button onClick={() => handleSaveProposal(true)} disabled={isSaving} className="gradient-bg text-white flex-1 md:flex-none">
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Mail className="w-4 h-4 mr-2"/>}
                            <span className="text-sm md:text-base">Αποθήκευση & Αποστολή</span>
                        </Button>
                    </div>
                </div>

                {/* Main Form Card */}
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                    <CardContent className="p-4 md:p-6">
                        <ProposalForm
                            proposal={proposal}
                            setProposal={setProposal}
                            clients={clients}
                            onNewClient={() => {}}
                        />

                        <div className="my-6 md:my-8">
                            <ProposalItemsTable items={items} setItems={setItems} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
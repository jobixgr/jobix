
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Proposal, ProposalItem, Client, Organization, ProposalLink } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Send, Edit, Loader2, AlertCircle, Mail, Phone, MapPin } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { el } from "date-fns/locale";
// ProposalDetailView is no longer imported if using inline print content
// import ProposalDetailView from "../components/proposals/ProposalDetailView"; // Import the view component

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

export default function ProposalDetail() {
    // Get proposal ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const proposalId = urlParams.get('id');
    
    const navigate = useNavigate();
    const { toast } = useToast();

    const [proposal, setProposal] = useState(null);
    const [items, setItems] = useState([]);
    const [client, setClient] = useState(null);
    const [organization, setOrganization] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Removed isPdfLoading state as window.print() is synchronous

    const loadData = useCallback(async () => {
        if (!proposalId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            let prop = null;
            // Extended retry logic with more attempts and exponential backoff
            for (let i = 0; i < 8; i++) {
                try {
                    prop = await Proposal.get(proposalId);
                    if (prop) break;
                } catch (err) {
                    console.log(`Attempt ${i + 1} failed:`, err.message);
                }
                // Exponential backoff: 500ms, 1s, 1.5s, 2s, 2.5s, 3s, 3.5s, 4s
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            }
            
            if (!prop) {
                console.log("Proposal not found after 8 retries");
                setProposal(null);
                setIsLoading(false);
                return;
            }
            
            console.log("Proposal loaded successfully:", prop);
            setProposal(prop);

            // Load related data
            const [proposalItems, clientData, orgData] = await Promise.all([
                ProposalItem.filter({ proposal_id: prop.id }).catch(() => []),
                prop.client_id ? Client.get(prop.client_id).catch(() => null) : Promise.resolve(null),
                prop.organization_id ? Organization.get(prop.organization_id).catch(() => null) : Promise.resolve(null)
            ]);
            
            setItems(proposalItems);
            setClient(clientData);
            setOrganization(orgData);

        } catch (err) {
            console.error("Error loading proposal:", err);
            setProposal(null);
        }
        setIsLoading(false);
    }, [proposalId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDownloadPDF = () => {
        window.print(); // Use native browser print dialog for PDF generation
    };
    
    const handleShareViaEmail = async () => {
        if (!proposal || !client || !organization) {
            toast({ title: "Σφάλμα", description: "Δεν βρέθηκαν όλα τα απαραίτητα δεδομένα.", variant: "destructive" });
            return;
        }

        if (!client.email) {
            toast({ title: "Σφάλμα", description: "Ο πελάτης δεν έχει δηλωμένο email.", variant: "destructive" });
            return;
        }

        try {
            const { sendProposalEmail } = await import("@/api/functions");
            
            toast({ title: "Αποστολή...", description: "Στέλνεται σύνδεσμος προσφοράς στον πελάτη..." });
            
            // Call the backend function WITHOUT the publicUrlBase
            await sendProposalEmail({ 
              proposalId: proposal.id
            }); 
            
            toast({ 
                title: "Επιτυχία! 🎉", 
                description: `Ένας σύνδεσμος στην προσφορά στάλθηκε στον ${client.name} στο ${client.email}` 
            });
            
            loadData();
        } catch (error) {
            console.error("Error sending email:", error);
            const errorMessage = error.response?.data?.details || error.response?.data?.error || `Αποτυχία αποστολής: ${error.message}`;
            toast({ 
                title: "Σφάλμα Αποστολής", 
                description: errorMessage, 
                variant: "destructive" 
            });
        }
    };

    if (isLoading) {
        return (
            <div className="p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="animate-pulse space-y-4 md:space-y-6">
                        <div className="h-6 md:h-8 bg-slate-200 rounded w-1/3"></div>
                        <div className="h-4 md:h-6 bg-slate-200 rounded w-1/4"></div>
                        <div className="space-y-4">
                            <div className="h-24 md:h-32 bg-slate-200 rounded"></div>
                            <div className="h-48 md:h-64 bg-slate-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!proposal) {
        return (
            <div className="p-4 md:p-8">
                <div className="max-w-4xl mx-auto text-center">
                    <AlertCircle className="w-10 md:w-12 h-10 md:w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-lg md:text-xl font-semibold text-slate-800 mb-2">Η προσφορά δεν βρέθηκε</h2>
                    <p className="text-sm md:text-base text-slate-500 mb-4 md:mb-6">Η προσφορά που αναζητάτε δεν υπάρχει ή έχει διαγραφεί.</p>
                    <Button onClick={() => navigate(createPageUrl("Proposals"))}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Επιστροφή στις Προσφορές
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="no-print p-3 md:p-8 space-y-4 md:space-y-6 min-h-screen bg-slate-50">
                <div className="max-w-4xl mx-auto">
                    {/* Header with action buttons */}
                    <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
                        <div>
                            <Button 
                                onClick={() => navigate(createPageUrl("Proposals"))} 
                                variant="ghost" 
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2 p-0"
                            >
                               <ArrowLeft className="w-4 h-4"/>
                               Επιστροφή στις Προσφορές
                            </Button>
                            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900">{proposal.title}</h1>
                            <div className="flex items-center gap-2 md:gap-4 mt-2">
                                <Badge className={statusColors[proposal.status]}>
                                    {statusLabels[proposal.status]}
                                </Badge>
                                <span className="text-xs md:text-sm text-slate-500">#{proposal.number}</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                            <Button 
                                onClick={() => navigate(createPageUrl("ProposalEdit") + "?id=" + proposal.id)}
                                variant="outline"
                                className="flex-1 sm:flex-none"
                            >
                                <Edit className="w-4 h-4 mr-2"/>
                                <span className="text-sm">Επεξεργασία</span>
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={handleDownloadPDF} 
                                className="flex-1 sm:flex-none"
                            >
                                <Download className="w-4 h-4 mr-2"/>
                                <span className="text-sm">Εκτύπωση/PDF</span>
                            </Button>
                            
                            {/* Share via Email Button */}
                            <Button 
                                onClick={handleShareViaEmail}
                                disabled={!client?.email} // Button is disabled if client email is not available
                                className="flex-1 sm:flex-none gradient-bg text-white"
                            >
                                <Send className="w-4 h-4 mr-2"/>
                                <span className="text-sm">
                                    Αποστολή σύνδεσμου
                                </span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Printable Content handled via window.print() */}
            <div id="printable-content" className="max-w-4xl mx-auto bg-white p-10 shadow-xl rounded-lg print-only">
                {/* Simplified view for printing */}
                 <h1 className="text-3xl font-bold">{proposal.title}</h1>
                 <p>#{proposal.number}</p>
                 <hr className="my-4"/>
                 <p>Client: {client?.name}</p>
                 <hr className="my-4"/>
                 <h2 className="text-xl font-semibold">Items</h2>
                 <ul>
                    {items.map(item => <li key={item.id}>{item.description} - €{item.line_total}</li>)}
                 </ul>
                 <hr className="my-4"/>
                 <p className="text-right font-bold text-xl">Total: €{proposal.total}</p>
            </div>
             <style>{`
                .print-only { display: none; }
                @media print {
                  .no-print { display: none; }
                  .print-only { display: block; }
                }
            `}</style>
        </>
    );
}

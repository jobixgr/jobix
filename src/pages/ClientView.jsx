
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Client, Proposal, Project, ClientAccess } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Trash2, FileText, FolderKanban, Loader2, Phone, Mail, MapPin, Building2, AlertCircle, Shield, Edit, Save, User as UserIcon } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { format } from "date-fns";
import { el } from "date-fns/locale";

const statusColors = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  planned: "bg-slate-100 text-slate-700",
  active: "bg-blue-100 text-blue-700",
  on_hold: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  canceled: "bg-gray-100 text-gray-700"
};

const statusLabels = {
  draft: "Πρόχειρο",
  sent: "Στάλθηκε",
  accepted: "Αποδεκτό",
  rejected: "Απορρίφθηκε",
  planned: "Σχεδιασμός",
  active: "Ενεργό",
  on_hold: "Σε Αναμονή",
  completed: "Ολοκληρωμένο",
  canceled: "Ακυρωμένο"
};

export default function ClientView() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const getClientId = useCallback(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }, []);

    const [client, setClient] = useState(null);
    const [editableClient, setEditableClient] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        const clientId = getClientId();
        
        if (!clientId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const clientData = await Client.get(clientId);
            
            if (!clientData) {
                setClient(null);
                setIsLoading(false);
                return;
            }

            setClient(clientData);
            setEditableClient({...clientData}); // Create a copy for editing
            
            const [proposalData, projectData] = await Promise.all([
                Proposal.filter({ client_id: clientId }).catch(() => []),
                Project.filter({ client_id: clientId }).catch(() => [])
            ]);
            
            setProposals(proposalData);
            setProjects(projectData);
            
        } catch (error) {
            console.error("Failed to load client data:", error);
            setClient(null);
            toast({ 
                title: "Σφάλμα", 
                description: `Δεν βρέθηκε ο πελάτης: ${error.message}`, 
                variant: "destructive" 
            });
        } finally {
            setIsLoading(false);
        }
    }, [getClientId, toast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleEdit = () => {
        setIsEditing(true);
        setEditableClient({...client}); // Reset editable client to current values
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditableClient({...client}); // Reset to original values
    };

    const handleSave = async () => {
        if (!editableClient?.name) {
            toast({ title: "Σφάλμα", description: "Το όνομα είναι υποχρεωτικό.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            await Client.update(client.id, editableClient);
            setClient({...editableClient}); // Update the display client
            setIsEditing(false);
            toast({ title: "Επιτυχία", description: "Οι πληροφορίες του πελάτη αποθηκεύτηκαν." });
        } catch (error) {
            console.error("Failed to save client:", error);
            toast({ title: "Σφάλμα", description: "Η αποθήκευση απέτυχε.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditableClient(prev => ({ ...prev, [name]: value }));
    };
    
    const handleDelete = async () => {
        const clientId = getClientId();
        
        if (window.confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε αυτόν τον πελάτη; Αυτή η ενέργεια δεν αναιρείται.")) {
            try {
                await Client.delete(clientId);
                toast({ title: "Επιτυχία", description: "Ο πελάτης διαγράφηκε." });
                navigate(createPageUrl('Clients'));
            } catch (error) {
                console.error("Failed to delete client:", error);
                toast({ title: "Σφάλμα", description: "Η διαγραφή απέτυχε.", variant: "destructive" });
            }
        }
    };
    
    const generateClientAccess = async () => {
        const currentClientId = getClientId();
        if (!currentClientId) {
            toast({ title: "Σφάλμα", description: "Δεν βρέθηκε ID πελάτη.", variant: "destructive" });
            return;
        }

        try {
            const existingAccess = await ClientAccess.filter({ client_id: currentClientId });
            let token;
            let accessRecord = existingAccess.length > 0 ? existingAccess[0] : null;
            
            if (accessRecord && accessRecord.is_active) {
                token = accessRecord.access_token;
                toast({
                    title: "Ο σύνδεσμος υπάρχει ήδη!",
                    description: "Ο σύνδεσμος της πύλης πελατών αντιγράφηκε στο πρόχειρο.",
                });
            } else {
                token = crypto.randomUUID();
                if (accessRecord) {
                    await ClientAccess.update(accessRecord.id, { access_token: token, is_active: true });
                } else {
                    await ClientAccess.create({ client_id: currentClientId, access_token: token, is_active: true });
                }
                toast({
                    title: "Επιτυχία!",
                    description: "Ο σύνδεσμος της πύλης πελατών αντιγράφηκε στο πρόχειρο."
                });
            }
            
            const portalUrl = `${window.location.origin}${createPageUrl("ClientPortal")}?token=${token}`;
            await navigator.clipboard.writeText(portalUrl);
            
        } catch (error) {
            console.error("Error generating client access:", error);
            toast({
                title: "Σφάλμα",
                description: "Αποτυχία δημιουργίας συνδέσμου πύλης πελατών.",
                variant: "destructive"
            });
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Δεν βρέθηκε πελάτης</h2>
                <Button asChild className="mt-4">
                    <Link to={createPageUrl("Clients")}>Επιστροφή</Link>
                </Button>
            </div>
        );
    }

    const currentClientId = getClientId();

    return (
        <div className="p-3 md:p-8 space-y-4 md:space-y-6 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <Button variant="ghost" asChild className="text-slate-600 pl-0">
                        <Link to={createPageUrl("Clients")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Επιστροφή στους Πελάτες
                        </Link>
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{client.name}</h1>
                        {client.company && <p className="text-sm md:text-base text-slate-600">{client.company}</p>}
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        {!isEditing ? (
                            <>
                                <Button 
                                    onClick={generateClientAccess}
                                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    <Shield className="w-4 h-4 mr-2" />
                                    Πύλη Πελάτη
                                </Button>
                                <Button onClick={handleEdit} variant="outline" className="flex-1 md:flex-none">
                                    <Edit className="w-4 h-4 mr-2" />
                                    Επεξεργασία
                                </Button>
                                <Button onClick={handleDelete} variant="destructive" size="icon">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button onClick={handleSave} disabled={isSaving} className="flex-1 md:flex-none gradient-bg text-white">
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Αποθήκευση
                                </Button>
                                <Button onClick={handleCancelEdit} variant="outline" className="flex-1 md:flex-none">
                                    Ακύρωση
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                    <div className="lg:col-span-1 space-y-4 md:space-y-6">
                        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                            <CardHeader><CardTitle>Στοιχεία Πελάτη</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                {isEditing ? (
                                    <>
                                        <div>
                                            <Label htmlFor="name">Ονοματεπώνυμο</Label>
                                            <Input 
                                                id="name" 
                                                name="name" 
                                                value={editableClient.name || ''} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="company">Εταιρεία</Label>
                                            <Input 
                                                id="company" 
                                                name="company" 
                                                value={editableClient.company || ''} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="phone">Τηλέφωνο</Label>
                                            <Input 
                                                id="phone" 
                                                name="phone" 
                                                value={editableClient.phone || ''} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="email">Email</Label>
                                            <Input 
                                                id="email" 
                                                name="email" 
                                                type="email"
                                                value={editableClient.email || ''} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <hr/>
                                        <h4 className="font-semibold text-slate-700">Φορολογικά Στοιχεία</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="afm">ΑΦΜ</Label>
                                                <Input 
                                                    id="afm" 
                                                    name="afm" 
                                                    value={editableClient.afm || ''} 
                                                    onChange={handleInputChange} 
                                                    maxLength={9}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="doy">ΔΟΥ</Label>
                                                <Input 
                                                    id="doy" 
                                                    name="doy" 
                                                    value={editableClient.doy || ''} 
                                                    onChange={handleInputChange} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label htmlFor="profession">Επάγγελμα</Label>
                                            <Input 
                                                id="profession" 
                                                name="profession" 
                                                value={editableClient.profession || ''} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <hr/>
                                        <h4 className="font-semibold text-slate-700">Διεύθυνση</h4>
                                        <div>
                                            <Label htmlFor="address">Οδός & Αριθμός</Label>
                                            <Input 
                                                id="address" 
                                                name="address" 
                                                value={editableClient.address || ''} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label htmlFor="postal_code">Τ.Κ.</Label>
                                                <Input 
                                                    id="postal_code" 
                                                    name="postal_code" 
                                                    value={editableClient.postal_code || ''} 
                                                    onChange={handleInputChange} 
                                                    maxLength={5}
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="city">Πόλη</Label>
                                                <Input 
                                                    id="city" 
                                                    name="city" 
                                                    value={editableClient.city || ''} 
                                                    onChange={handleInputChange} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <Label htmlFor="country">Χώρα</Label>
                                            <Input 
                                                id="country" 
                                                name="country" 
                                                value={editableClient.country || 'Ελλάδα'} 
                                                onChange={handleInputChange} 
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-3 text-sm">
                                        <p className="flex items-center gap-3"><UserIcon className="w-4 h-4 text-slate-400" /> <span className="font-medium">{client.name}</span></p>
                                        {client.company && <p className="flex items-center gap-3"><Building2 className="w-4 h-4 text-slate-400" /> {client.company}</p>}
                                        {client.phone && <p className="flex items-center gap-3"><Phone className="w-4 h-4 text-slate-400" /> {client.phone}</p>}
                                        {client.email && <p className="flex items-center gap-3"><Mail className="w-4 h-4 text-slate-400" /> {client.email}</p>}
                                        {client.address && <p className="flex items-center gap-3"><MapPin className="w-4 h-4 text-slate-400" /> {client.address}, {client.city} {client.postal_code}</p>}
                                        
                                        {(client.afm || client.doy || client.profession) && <hr className="my-4"/>}

                                        {client.afm && <p className="flex justify-between"><span>ΑΦΜ:</span> <span className="font-mono">{client.afm}</span></p>}
                                        {client.doy && <p className="flex justify-between"><span>ΔΟΥ:</span> <span className="font-medium">{client.doy}</span></p>}
                                        {client.profession && <p className="flex justify-between"><span>Επάγγελμα:</span> <span className="font-medium">{client.profession}</span></p>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        {!isEditing && (
                            <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                                <CardHeader><CardTitle>Γρήγορες Ενέργειες</CardTitle></CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <Button onClick={() => navigate(createPageUrl('ProposalNew') + `?client_id=${client.id}`)} variant="outline" className="w-full">
                                        <FileText className="w-4 h-4 mr-2"/>
                                        Νέα Προσφορά
                                    </Button>
                                    <Button onClick={() => navigate(createPageUrl('ProjectNew') + `?client_id=${client.id}`)} variant="outline" className="w-full">
                                        <FolderKanban className="w-4 h-4 mr-2"/>
                                        Νέο Έργο
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {!isEditing && (
                        <div className="lg:col-span-2">
                            <Tabs defaultValue="proposals" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                                    <TabsTrigger value="proposals"><FileText className="w-4 h-4 mr-2"/>Προσφορές ({proposals.length})</TabsTrigger>
                                    <TabsTrigger value="projects"><FolderKanban className="w-4 h-4 mr-2"/>Έργα ({projects.length})</TabsTrigger>
                                </TabsList>
                                <TabsContent value="proposals">
                                    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                                       <CardHeader><CardTitle>Ιστορικό Προσφορών</CardTitle></CardHeader>
                                       <CardContent>
                                         {proposals.length > 0 ? (
                                            <div className="space-y-3">
                                                {proposals.map(p => (
                                                    <Link key={p.id} to={createPageUrl("ProposalDetail") + `?id=${p.id}`}>
                                                        <div className="p-3 md:p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-semibold text-slate-900 break-words">{p.title}</h4>
                                                                <Badge className={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                                                            </div>
                                                            <div className="flex justify-between text-sm text-slate-500">
                                                                <span>#{p.number}</span>
                                                                <span className="font-semibold">€{p.total?.toLocaleString('el-GR')}</span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                         ) : <p className="text-slate-500 text-center py-6">Δεν υπάρχουν προσφορές για αυτόν τον πελάτη.</p>}
                                       </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent value="projects">
                                    <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                                       <CardHeader><CardTitle>Έργα</CardTitle></CardHeader>
                                       <CardContent>
                                         {projects.length > 0 ? (
                                            <div className="space-y-3">
                                                {projects.map(p => (
                                                    <Link key={p.id} to={createPageUrl("ProjectView") + "?id=" + p.id}>
                                                        <div className="p-3 md:p-4 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-semibold text-slate-900 break-words">{p.title}</h4>
                                                                <Badge className={statusColors[p.status]}>{statusLabels[p.status]}</Badge>
                                                            </div>
                                                            <div className="flex justify-between text-sm text-slate-500">
                                                                <span>{p.start_date ? format(new Date(p.start_date), 'dd MMM yyyy', { locale: el }) : ''}</span>
                                                                <span className="font-semibold">€{p.budget_total?.toLocaleString('el-GR')}</span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                         ) : <p className="text-slate-500 text-center py-6">Δεν υπάρχουν έργα για αυτόν τον πελάτη.</p>}
                                       </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

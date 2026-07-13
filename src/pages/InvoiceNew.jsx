
import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Invoice, InvoiceItem, Client, Project, ProposalItem, Organization, User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Trash2, Plus, Loader2, AlertCircle, Send } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from 'date-fns';

export default function InvoiceNew() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [organization, setOrganization] = useState(null);
    const [clients, setClients] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [isFetchingItems, setIsFetchingItems] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [invoice, setInvoice] = useState({
        number: '',
        status: 'draft',
        client_id: '',
        project_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        notes: 'Σας ευχαριστούμε για την προτίμησή σας.',
        client_details: {
            name: '',
            email: '',
            phone: '',
            address: '',
            afm: '',
            doy: '',
            profession: ''
        }
    });

    const [items, setItems] = useState([
        { id: 'new-1', description: 'Εργασίες', quantity: 1, unit: 'τεμ.', unit_price: 0, vat_rate: 24, line_total: 0 }
    ]);

    const [vatEnabled, setVatEnabled] = useState(true);
    const [preselectedProjectId, setPreselectedProjectId] = useState(null);

    // Get project_id from URL if provided
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdFromUrl = urlParams.get('project_id');

    const updateClientDetails = useCallback((client) => {
        if (!client) {
            setInvoice(prev => ({
                ...prev,
                client_details: {
                    name: '',
                    email: '',
                    phone: '',
                    address: '',
                    afm: '',
                    doy: '',
                    profession: ''
                }
            }));
            return;
        }

        setInvoice(prev => ({
            ...prev,
            client_details: {
                name: client.name || '',
                email: client.email || '',
                phone: client.phone || '',
                address: client.address || '',
                afm: client.afm || '',
                doy: client.doy || '',
                profession: client.profession || ''
            }
        }));
    }, []);

    const fetchAndSetProjectItems = useCallback(async (project) => {
        if (!project) return;
        
        setIsFetchingItems(true);
        try {
            // Try to get detailed items from proposal first
            if (project.proposal_id) {
                const proposalItems = await ProposalItem.filter({ proposal_id: project.proposal_id });
                if (proposalItems && proposalItems.length > 0) {
                    const newInvoiceItems = proposalItems.map(item => ({
                        id: `proj-item-${item.id}-${Date.now()}`,
                        description: item.description,
                        quantity: item.quantity || 1,
                        unit: item.unit || 'τεμ.',
                        unit_price: item.unit_price || 0,
                        vat_rate: vatEnabled ? (item.vat_rate !== undefined ? item.vat_rate : 24) : 0,
                        line_total: (item.quantity || 1) * (item.unit_price || 0)
                    }));
                    setItems(newInvoiceItems);
                    toast({ 
                        title: "Αναλυτικές Εργασίες Φορτώθηκαν! ✅", 
                        description: `${proposalItems.length} εργασίες από την προσφορά προστέθηκαν.` 
                    });
                    return;
                }
            }

            // Fallback to project budget if no detailed items
            if (project.budget_total && project.budget_total > 0) {
                setItems([{ 
                    id: `proj-total-${project.id}-${Date.now()}`, 
                    description: `Εργασίες για το έργο: ${project.title}`, 
                    quantity: 1, 
                    unit: 'έργο', 
                    unit_price: project.budget_total, 
                    vat_rate: vatEnabled ? 24 : 0,
                    line_total: project.budget_total 
                }]);
                toast({ 
                    title: "Συνολικό Κόστος Φορτώθηκε 💰", 
                    description: `€${project.budget_total} από το budget του έργου.` 
                });
            } else {
                setItems([{ 
                    id: `new-${Date.now()}`, 
                    description: 'Εργασίες', 
                    quantity: 1, 
                    unit: 'τεμ.', 
                    unit_price: 0, 
                    vat_rate: vatEnabled ? 24 : 0, 
                    line_total: 0 
                }]);
                toast({ 
                    title: "Δεν Βρέθηκε Κόστος", 
                    description: "Συμπληρώστε τις εργασίες χειροκίνητα.", 
                    variant: "default" 
                });
            }

        } catch (error) {
            console.error("Failed to fetch project items:", error);
            toast({ 
                title: "Σφάλμα Φόρτωσης", 
                description: `Δεν ήταν δυνατή η φόρτωση των εργασιών: ${error.message}`, 
                variant: "destructive" 
            });
            // Set default item on error
            setItems([{ 
                id: `error-${Date.now()}`, 
                description: 'Εργασίες', 
                quantity: 1, 
                unit: 'τεμ.', 
                unit_price: 0, 
                vat_rate: vatEnabled ? 24 : 0, 
                line_total: 0 
            }]);
        } finally {
            setIsFetchingItems(false);
        }
    }, [toast, vatEnabled]);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            if (!currentUser?.organization_id) {
                toast({
                    title: "Απαιτείται Οργάνωση",
                    description: "Δημιουργήστε οργάνωση από τις Ρυθμίσεις πρώτα.",
                    variant: "destructive",
                });
                return;
            }

            const [orgData, clientsData, projectsData] = await Promise.all([
                Organization.get(currentUser.organization_id),
                Client.filter({ organization_id: currentUser.organization_id }),
                Project.filter({ organization_id: currentUser.organization_id })
            ]);

            setOrganization(orgData);
            setClients(clientsData || []);
            setProjects(projectsData || []);

            // Generate invoice number
            const lastInvoice = await Invoice.filter({ organization_id: currentUser.organization_id }, '-created_date', 1);
            const lastNumber = lastInvoice[0]?.number ? parseInt(lastInvoice[0].number.split('-').pop()) : 0;
            const newNumber = `INV-${(lastNumber + 1).toString().padStart(4, '0')}`;
            
            setInvoice(prev => ({ 
                ...prev, 
                number: newNumber,
                organization_id: currentUser.organization_id
            }));

            // Handle preselected project
            if (projectIdFromUrl) {
                const project = projectsData.find(p => p.id === projectIdFromUrl);
                if (project) {
                    setPreselectedProjectId(projectIdFromUrl);
                    setSelectedProject(project);
                    setInvoice(prev => ({ ...prev, project_id: projectIdFromUrl, client_id: project.client_id || '' }));
                    
                    // Load client details if project has client
                    if (project.client_id) {
                        const client = clientsData.find(c => c.id === project.client_id);
                        if (client) {
                            setSelectedClient(client);
                            updateClientDetails(client);
                        }
                    }
                    
                    await fetchAndSetProjectItems(project);
                }
            }

        } catch (error) {
            console.error("Error loading initial data:", error);
            toast({ 
                title: "Σφάλμα", 
                description: `Αποτυχία φόρτωσης δεδομένων: ${error.message}`, 
                variant: "destructive" 
            });
        }
        setIsLoading(false);
    }, [projectIdFromUrl, toast, updateClientDetails, fetchAndSetProjectItems]); // Added updateClientDetails, fetchAndSetProjectItems to deps

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // Update VAT rates when VAT is toggled
    useEffect(() => {
        setItems(prevItems => 
            prevItems.map(item => ({
                ...item,
                vat_rate: vatEnabled ? (item.vat_rate > 0 ? item.vat_rate : 24) : 0
            }))
        );
    }, [vatEnabled]);

    const handleClientChange = useCallback(async (clientId) => {
        if (clientId === 'none' || !clientId) {
            setSelectedClient(null);
            setInvoice(prev => ({ ...prev, client_id: '' }));
            updateClientDetails(null);
            return;
        }

        const client = clients.find(c => c.id === clientId);
        if (client) {
            setSelectedClient(client);
            setInvoice(prev => ({ ...prev, client_id: clientId }));
            updateClientDetails(client);
        }
    }, [clients, updateClientDetails]);

    const handleProjectChange = useCallback(async (projectId) => {
        if (projectId === 'none' || !projectId) {
            setSelectedProject(null);
            setInvoice(prev => ({ ...prev, project_id: '' }));
            // Reset items to default
            setItems([{ 
                id: `reset-${Date.now()}`, 
                description: 'Εργασίες', 
                quantity: 1, 
                unit: 'τεμ.', 
                unit_price: 0, 
                vat_rate: vatEnabled ? 24 : 0, 
                line_total: 0 
            }]);
            return;
        }

        const project = projects.find(p => p.id === projectId);
        if (project) {
            setSelectedProject(project);
            setInvoice(prev => ({ ...prev, project_id: projectId }));
            
            // Auto-select client if project has one
            if (project.client_id && project.client_id !== invoice.client_id) {
                await handleClientChange(project.client_id);
            }
            
            await fetchAndSetProjectItems(project);
        }
    }, [projects, invoice.client_id, handleClientChange, fetchAndSetProjectItems, vatEnabled]);

    const handleAddItem = () => {
        setItems([
            ...items,
            { 
                id: `new-${Date.now()}`, 
                description: '', 
                quantity: 1, 
                unit: 'τεμ.', 
                unit_price: 0, 
                vat_rate: vatEnabled ? 24 : 0, 
                line_total: 0 
            }
        ]);
    };

    const handleDeleteItem = (index) => {
        if (items.length > 1) {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
        }
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        
        // Recalculate line total if quantity or unit_price changes
        if (field === 'quantity' || field === 'unit_price') {
            newItems[index].line_total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
        }
        
        setItems(newItems);
    };

    const calculateTotals = () => {
        const subtotal = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
        const vat_amount = items.reduce((sum, item) => {
            const itemVat = (item.line_total || 0) * (item.vat_rate || 0) / 100;
            return sum + itemVat;
        }, 0);
        const total = subtotal + vat_amount;
        
        return { subtotal, vat_amount, total };
    };

    const handleSaveInvoice = async (shouldSend = false) => {
        if (!organization || !invoice.client_details.name) {
            toast({ 
                title: "Ελλιπή Στοιχεία", 
                description: "Συμπληρώστε τα στοιχεία του πελάτη.", 
                variant: "destructive" 
            });
            return;
        }

        if (items.length === 0 || items.every(item => (item.unit_price || 0) === 0)) {
            toast({ 
                title: "Χωρίς Εργασίες", 
                description: "Προσθέστε τουλάχιστον μία εργασία με τιμή.", 
                variant: "destructive" 
            });
            return;
        }

        setIsSaving(true);
        try {
            const totals = calculateTotals();

            const newInvoice = await Invoice.create({
                ...invoice,
                ...totals,
                status: shouldSend ? 'sent' : 'draft'
            });

            if (items.length > 0) {
                const itemsToCreate = items.map(item => ({
                    invoice_id: newInvoice.id,
                    description: item.description,
                    quantity: item.quantity || 1,
                    unit: item.unit || 'τεμ.',
                    unit_price: item.unit_price || 0,
                    vat_rate: item.vat_rate || 0,
                    line_total: item.line_total || 0
                }));
                await InvoiceItem.bulkCreate(itemsToCreate);
            }

            if (shouldSend && invoice.client_details.email) {
                try {
                    const { sendInvoiceEmail } = await import("@/api/functions");
                    await sendInvoiceEmail({ invoiceId: newInvoice.id });
                    toast({ 
                        title: "Επιτυχία! 🎉", 
                        description: `Το τιμολόγιο δημιουργήθηκε και στάλθηκε στο ${invoice.client_details.email}` 
                    });
                } catch (emailError) {
                    console.error("Email send error:", emailError);
                    toast({ 
                        title: "Τιμολόγιο Δημιουργήθηκε", 
                        description: "Αλλά δεν στάλθηκε email. Μπορείτε να το στείλετε χειροκίνητα.", 
                        variant: "default" 
                    });
                }
            } else {
                toast({ 
                    title: "Επιτυχία!", 
                    description: shouldSend ? "Τιμολόγιο δημιουργήθηκε (χωρίς email λόγω ελλιπών στοιχείων)" : "Το τιμολόγιο αποθηκεύτηκε ως πρόχειρο." 
                });
            }

            setTimeout(() => {
                navigate(createPageUrl('InvoiceView') + "?id=" + newInvoice.id);
            }, 1500);

        } catch (error) {
            console.error("Error saving invoice:", error);
            toast({
                title: "Σφάλμα",
                description: `Αποτυχία αποθήκευσης: ${error.message}`,
                variant: "destructive"
            });
        }
        setIsSaving(false);
    };

    const { subtotal, vat_amount, total } = calculateTotals();

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 space-y-6">
                <div className="max-w-6xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-slate-200 rounded w-64"></div>
                        <div className="h-96 bg-slate-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <Link to={createPageUrl("Invoices")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
                            <ArrowLeft className="w-4 h-4" />
                            Επιστροφή στα Τιμολόγια
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Δημιουργία Νέου Τιμολογίου</h1>
                    </div>
                </div>

                {!organization && (
                    <Alert className="mb-6 bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800">Απαιτείται Οργάνωση</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                            Δημιουργήστε οργάνωση από τις Ρυθμίσεις για να συνεχίσετε.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Invoice Details */}
                        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-blue-600" />
                                    </div>
                                    Στοιχεία Τιμολογίου
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="client">Επιλογή Πελάτη (προαιρετικό)</Label>
                                        <Select value={invoice.client_id || 'none'} onValueChange={handleClientChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Επιλέξτε πελάτη ή συμπληρώστε χειροκίνητα" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">-- Κανένας --</SelectItem>
                                                {clients.map(client => (
                                                    <SelectItem key={client.id} value={client.id}>
                                                        {client.name} {client.company ? `(${client.company})` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="project">Έργο (προαιρετικό)</Label>
                                        <Select 
                                            value={invoice.project_id || 'none'} 
                                            onValueChange={handleProjectChange}
                                            disabled={isFetchingItems}
                                        >
                                            <SelectTrigger>
                                                <div className="flex items-center gap-2">
                                                    {isFetchingItems && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                                                    <SelectValue placeholder="Επιλέξτε έργο" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">-- Κανένα --</SelectItem>
                                                {projects.filter(p => !invoice.client_id || p.client_id === invoice.client_id).map(project => (
                                                    <SelectItem key={project.id} value={project.id}>
                                                        {project.title}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="invoice_number">Αριθμός Τιμολογίου</Label>
                                        <Input
                                            id="invoice_number"
                                            value={invoice.number}
                                            onChange={(e) => setInvoice(prev => ({ ...prev, number: e.target.value }))}
                                            placeholder="INV-0001"
                                        />
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="vat_enabled" 
                                            checked={vatEnabled}
                                            onCheckedChange={setVatEnabled}
                                        />
                                        <Label htmlFor="vat_enabled" className="text-sm font-medium">
                                            Εφαρμογή ΦΠΑ στο τιμολόγιο
                                        </Label>
                                    </div>

                                    <div>
                                        <Label htmlFor="issue_date">Ημερομηνία Έκδοσης</Label>
                                        <Input
                                            id="issue_date"
                                            type="date"
                                            value={invoice.issue_date}
                                            onChange={(e) => setInvoice(prev => ({ ...prev, issue_date: e.target.value }))}
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="due_date">Ημερομηνία Λήξης</Label>
                                        <Input
                                            id="due_date"
                                            type="date"
                                            value={invoice.due_date}
                                            onChange={(e) => setInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Client Details */}
                        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                            <CardHeader>
                                <CardTitle>Στοιχεία Πελάτη</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="client_name">Όνομα / Επωνυμία *</Label>
                                        <Input
                                            id="client_name"
                                            value={invoice.client_details.name}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, name: e.target.value }
                                            }))}
                                            placeholder="π.χ. Γιάννης Παπαδόπουλος"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="client_email">Email</Label>
                                        <Input
                                            id="client_email"
                                            type="email"
                                            value={invoice.client_details.email}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, email: e.target.value }
                                            }))}
                                            placeholder="π.χ. giannis@example.gr"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="client_phone">Τηλέφωνο</Label>
                                        <Input
                                            id="client_phone"
                                            value={invoice.client_details.phone}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, phone: e.target.value }
                                            }))}
                                            placeholder="π.χ. 6981234567"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="client_profession">Επάγγελμα</Label>
                                        <Input
                                            id="client_profession"
                                            value={invoice.client_details.profession}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, profession: e.target.value }
                                            }))}
                                            placeholder="π.χ. Μηχανικός"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <Label htmlFor="client_address">Διεύθυνση</Label>
                                        <Input
                                            id="client_address"
                                            value={invoice.client_details.address}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, address: e.target.value }
                                            }))}
                                            placeholder="π.χ. Λεωφ. Κηφισίας 123, Μαρούσι 15122"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="client_afm">ΑΦΜ</Label>
                                        <Input
                                            id="client_afm"
                                            value={invoice.client_details.afm}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, afm: e.target.value }
                                            }))}
                                            placeholder="π.χ. 123456789"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="client_doy">ΔΟΥ</Label>
                                        <Input
                                            id="client_doy"
                                            value={invoice.client_details.doy}
                                            onChange={(e) => setInvoice(prev => ({ 
                                                ...prev, 
                                                client_details: { ...prev.client_details, doy: e.target.value }
                                            }))}
                                            placeholder="π.χ. Α' ΑΘΗΝΩΝ"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Invoice Items */}
                        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>Εργασίες & Υλικά</CardTitle>
                                    <Button onClick={handleAddItem} variant="outline" size="sm">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Προσθήκη Γραμμής
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {items.map((item, index) => (
                                        <div key={item.id} className="border border-slate-200 rounded-lg p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                                                <div className="md:col-span-2">
                                                    <Label>Περιγραφή</Label>
                                                    <Input
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                        placeholder="π.χ. Εγκατάσταση πλακακιών"
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Ποσότητα</Label>
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                        placeholder="1"
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Μονάδα</Label>
                                                    <Input
                                                        value={item.unit}
                                                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                                                        placeholder="τμ."
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Τιμή (€)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.unit_price}
                                                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                    />
                                                </div>

                                                <div>
                                                    <Label>ΦΠΑ %</Label>
                                                    <Select
                                                        value={item.vat_rate.toString()}
                                                        onValueChange={(value) => handleItemChange(index, 'vat_rate', parseInt(value))}
                                                        disabled={!vatEnabled}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="0">0%</SelectItem>
                                                            <SelectItem value="6">6%</SelectItem>
                                                            <SelectItem value="13">13%</SelectItem>
                                                            <SelectItem value="24">24%</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                                                <div className="text-lg font-semibold">
                                                    Σύνολο: €{(item.line_total || 0).toFixed(2)}
                                                </div>
                                                {items.length > 1 && (
                                                    <Button 
                                                        onClick={() => handleDeleteItem(index)} 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                            <CardHeader>
                                <CardTitle>Σημειώσεις & Όροι</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Textarea
                                    value={invoice.notes}
                                    onChange={(e) => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="π.χ. Το τιμολόγιο είναι εξόφλητο σε 30 ημέρες από την έκδοση..."
                                    rows={3}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="space-y-6">
                        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg sticky top-6">
                            <CardHeader>
                                <CardTitle className="text-blue-800">Σύνοψη Τιμολογίου</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Καθαρή Αξία:</span>
                                        <span className="font-medium">€{subtotal.toFixed(2)}</span>
                                    </div>
                                    
                                    {vatEnabled && vat_amount > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Σύνολο ΦΠΑ:</span>
                                            <span className="font-medium">€{vat_amount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    
                                    <div className="border-t border-blue-200 pt-3 flex justify-between text-lg font-bold text-blue-800">
                                        <span>Συνολικό Ποσό:</span>
                                        <span>€{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-blue-200">
                                    <Button 
                                        onClick={() => handleSaveInvoice(false)} 
                                        disabled={isSaving || !organization} 
                                        className="w-full bg-slate-600 hover:bg-slate-700"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Αποθήκευση ως Πρόχειρο
                                    </Button>

                                    <Button 
                                        onClick={() => handleSaveInvoice(true)} 
                                        disabled={isSaving || !organization || !invoice.client_details.email} 
                                        className="w-full gradient-bg text-white"
                                    >
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                        Αποθήκευση & Αποστολή
                                    </Button>

                                    {!invoice.client_details.email && (
                                        <p className="text-xs text-amber-600 text-center">
                                            Προσθέστε email για αποστολή
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

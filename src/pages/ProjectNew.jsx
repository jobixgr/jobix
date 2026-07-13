
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, FolderKanban, Loader2, AlertCircle } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { Project, Client, User, Organization } from "@/api/entities";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ProjectNew() {
    const navigate = useNavigate();
    const { toast } = useToast();
    
    const [user, setUser] = useState(null);
    const [organization, setOrganization] = useState(null);
    const [clients, setClients] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    
    const [project, setProject] = useState({
        title: "",
        description: "",
        client_id: "",
        status: 'planned',
        start_date: new Date().toISOString().split('T')[0],
        end_date: "",
        budget_total: "",
        notes: ""
    });

    const loadInitialData = useCallback(async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);

            if (!currentUser.organization_id) {
                toast({
                    title: "Απαιτείται Οργάνωση",
                    description: "Δημιουργήστε μια οργάνωση από τις Ρυθμίσεις πρώτα.",
                    variant: "destructive"
                });
                return;
            }

            const [org, clientsData] = await Promise.all([
                Organization.get(currentUser.organization_id),
                Client.filter({ organization_id: currentUser.organization_id })
            ]);

            setOrganization(org);
            setClients(clientsData);

        } catch (error) {
            console.error("Error loading initial data:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης δεδομένων.", variant: "destructive" });
        }
    }, [toast]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProject(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setProject(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!project.title.trim() || !project.client_id) {
            toast({ title: "Σφάλμα", description: "Συμπληρώστε τον τίτλο και επιλέξτε πελάτη.", variant: "destructive" });
            return;
        }

        if (!organization) {
            toast({ title: "Σφάλμα", description: "Δεν βρέθηκε οργάνωση.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const newProject = await Project.create({
                ...project,
                organization_id: organization.id,
                budget_total: project.budget_total ? parseFloat(project.budget_total) : null
            });

            toast({ title: "Επιτυχία!", description: "Το έργο δημιουργήθηκε." });
            navigate(createPageUrl('ProjectView') + '?id=' + newProject.id);

        } catch (error) {
            console.error("Error saving project:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία αποθήκευσης έργου.", variant: "destructive" });
        }
        setIsSaving(false);
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <Link to={createPageUrl("Projects")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
                            <ArrowLeft className="w-4 h-4" />
                            Επιστροφή στα Έργα
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Νέο Έργο</h1>
                        <p className="text-slate-600">Δημιουργία νέου έργου από την αρχή</p>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving || !organization} className="gradient-bg text-white">
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Δημιουργία Έργου
                    </Button>
                </div>

                {!organization && (
                    <Alert className="mb-6 bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle className="text-yellow-800">Απαιτείται Οργάνωση</AlertTitle>
                        <AlertDescription className="text-yellow-700">
                            Δημιουργήστε μια οργάνωση από τις Ρυθμίσεις για να συνεχίσετε.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Main Form */}
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderKanban className="w-5 h-5 text-purple-500" />
                            Στοιχεία Έργου
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <Label htmlFor="title">Τίτλος Έργου *</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={project.title}
                                    onChange={handleInputChange}
                                    placeholder="π.χ. Ανακαίνιση Διαμερίσματος στο Κολωνάκι"
                                />
                            </div>

                            <div>
                                <Label htmlFor="client_id">Πελάτης *</Label>
                                <Select name="client_id" value={project.client_id} onValueChange={(value) => handleSelectChange('client_id', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Επιλέξτε πελάτη..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map(client => (
                                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="status">Κατάσταση</Label>
                                <Select name="status" value={project.status} onValueChange={(value) => handleSelectChange('status', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planned">Σε Προγραμματισμό</SelectItem>
                                        <SelectItem value="active">Ενεργό</SelectItem>
                                        <SelectItem value="on_hold">Σε Αναμονή</SelectItem>
                                        <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
                                        <SelectItem value="canceled">Ακυρωμένο</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="start_date">Ημερομηνία Έναρξης</Label>
                                <Input
                                    id="start_date"
                                    name="start_date"
                                    type="date"
                                    value={project.start_date}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div>
                                <Label htmlFor="end_date">Ημερομηνία Λήξης</Label>
                                <Input
                                    id="end_date"
                                    name="end_date"
                                    type="date"
                                    value={project.end_date}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div>
                                <Label htmlFor="budget_total">Προϋπολογισμός (€)</Label>
                                <Input
                                    id="budget_total"
                                    name="budget_total"
                                    type="number"
                                    step="0.01"
                                    value={project.budget_total}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <Label htmlFor="description">Περιγραφή Έργου</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    value={project.description}
                                    onChange={handleInputChange}
                                    placeholder="Αναλυτική περιγραφή του έργου..."
                                    className="h-24"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <Label htmlFor="notes">Σημειώσεις</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    value={project.notes}
                                    onChange={handleInputChange}
                                    placeholder="Πρόσθετες σημειώσεις..."
                                    className="h-24"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

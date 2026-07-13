
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, Client } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ArrowLeft, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';

export default function ProjectEdit() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    const navigate = useNavigate();
    const { toast } = useToast();

    const [project, setProject] = useState(null);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!projectId) {
                setIsLoading(false);
                return;
            }
            try {
                const [projectData, clientData] = await Promise.all([
                    Project.get(projectId),
                    Client.list()
                ]);
                setProject(projectData);
                setClients(clientData);
            } catch (error) {
                console.error("Error loading data:", error);
                toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης δεδομένων.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [projectId, toast]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProject(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setProject(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!project.title) {
            toast({ title: "Σφάλμα", description: "Ο τίτλος του έργου είναι υποχρεωτικός.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            await Project.update(project.id, {
                title: project.title,
                description: project.description,
                status: project.status,
                client_id: project.client_id,
                start_date: project.start_date || null,
                end_date: project.end_date || null,
                budget_total: Number(project.budget_total) || 0,
                notes: project.notes
            });
            toast({ title: "Επιτυχία", description: "Το έργο αποθηκεύτηκε." });
            navigate(createPageUrl('ProjectView') + `?id=${project.id}`);
        } catch (error) {
            console.error("Error saving project:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία αποθήκευσης του έργου.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (isLoading) {
        return (
            <div className="p-8 flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }
    
    if (!project) {
        return (
             <div className="p-4 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
                <div className="max-w-md w-full text-center">
                    <Card className="bg-white/80 backdrop-blur-sm shadow-xl p-8">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Το έργο δεν βρέθηκε</h2>
                        <p className="text-slate-500 mb-6">Το έργο που ψάχνετε δεν υπάρχει, έχει διαγραφεί, ή ο σύνδεσμος είναι λανθασμένος.</p>
                        <Button onClick={() => navigate(createPageUrl('Projects'))} className="gradient-bg text-white w-full">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Επιστροφή στη Λίστα Έργων
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
            <div className="max-w-4xl mx-auto">
                 <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate(createPageUrl('ProjectView') + `?id=${projectId}`)} className="text-slate-600 pl-0">
                        <ArrowLeft className="w-4 h-4 mr-2"/>
                        Επιστροφή στο Έργο
                    </Button>
                    <h1 className="text-3xl font-bold text-slate-800">Επεξεργασία Έργου</h1>
                </div>

                <Card>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">Τίτλος Έργου</label>
                                <Input id="title" name="title" value={project.title} onChange={handleInputChange} placeholder="π.χ. Ανακαίνιση Κουζίνας" />
                            </div>
                             <div>
                                <label htmlFor="status" className="block text-sm font-medium text-slate-700 mb-1">Κατάσταση</label>
                                <Select value={project.status} onValueChange={(value) => handleSelectChange('status', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Επιλογή κατάστασης..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planned">Σχεδιασμός</SelectItem>
                                        <SelectItem value="active">Ενεργό</SelectItem>
                                        <SelectItem value="on_hold">Σε Αναμονή</SelectItem>
                                        <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
                                        <SelectItem value="canceled">Ακυρωμένο</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div>
                           <label htmlFor="client_id" className="block text-sm font-medium text-slate-700 mb-1">Πελάτης</label>
                           <Select value={project.client_id} onValueChange={(value) => handleSelectChange('client_id', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Επιλογή πελάτη..."/>
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(client => (
                                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                    ))}
                                </SelectContent>
                           </Select>
                        </div>
                        
                        <div>
                           <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">Περιγραφή</label>
                           <Textarea id="description" name="description" value={project.description || ''} onChange={handleInputChange} placeholder="Λεπτομέρειες για το έργο..."/>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label htmlFor="start_date" className="block text-sm font-medium text-slate-700 mb-1">Ημ/νία Έναρξης</label>
                                <Input id="start_date" name="start_date" type="date" value={project.start_date || ''} onChange={handleInputChange} />
                            </div>
                             <div>
                                <label htmlFor="end_date" className="block text-sm font-medium text-slate-700 mb-1">Ημ/νία Λήξης</label>
                                <Input id="end_date" name="end_date" type="date" value={project.end_date || ''} onChange={handleInputChange} />
                            </div>
                        </div>
                        
                        <div>
                           <label htmlFor="budget_total" className="block text-sm font-medium text-slate-700 mb-1">Συνολικός Προϋπολογισμός (€)</label>
                           <Input id="budget_total" name="budget_total" type="number" value={project.budget_total || ''} onChange={handleInputChange} placeholder="π.χ. 5000" />
                        </div>
                        
                        <div>
                           <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">Σημειώσεις</label>
                           <Textarea id="notes" name="notes" value={project.notes || ''} onChange={handleInputChange} placeholder="Πρόσθετες σημειώσεις..."/>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="mt-6 flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving} className="gradient-bg text-white">
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                        Αποθήκευση Αλλαγών
                    </Button>
                </div>
            </div>
        </div>
    );
}

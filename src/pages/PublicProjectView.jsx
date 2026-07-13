
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicProject } from '@/api/functions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, ListTodo, History } from 'lucide-react';
import { format } from "date-fns";
import { el } from "date-fns/locale";

export default function PublicProjectView() {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [payments, setPayments] = useState([]);
    const [files, setFiles] = useState([]);
    const [organization, setOrganization] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Δημόσιο endpoint: επιστρέφει μόνο τα δεδομένα του συγκεκριμένου
                // έργου, χωρίς να απαιτεί (ή να εκθέτει) λογαριασμό χρήστη.
                const data = await publicProject(id);
                if (data?.project) {
                    setProject(data.project);
                    setTasks(data.tasks || []);
                    setPayments(data.payments || []);
                    setFiles(data.files || []);
                    setOrganization(data.organization);
                }
            } catch (error) {
                console.error("Failed to load project portal data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [id]);

    if (isLoading) {
        return <div className="p-8"><Skeleton className="h-screen w-full" /></div>;
    }

    if (!project) {
        return <div className="p-8 text-center">Το έργο που αναζητάτε δεν βρέθηκε.</div>;
    }

    const doneTasks = tasks.filter(t => t.status === 'done').length;
    const progress = tasks.length > 0 ? (doneTasks / tasks.length) * 100 : 0;
    
    const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const totalAmount = project.budget_total || payments.reduce((sum, p) => sum + p.amount, 0);
    const outstandingAmount = totalAmount - paidAmount;
    
    const taskGroups = {
        done: tasks.filter(t => t.status === 'done'),
        in_progress: tasks.filter(t => t.status === 'in_progress'),
        todo: tasks.filter(t => t.status === 'todo'),
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8">
            <header className="max-w-6xl mx-auto mb-8">
                <div className="flex items-center gap-4">
                     {organization?.logo_url ? (
                        <img src={organization.logo_url} alt={organization.name} className="h-12"/>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="gradient-bg w-10 h-10 rounded-lg flex items-center justify-center text-white">
                                <span className="text-lg font-bold">J</span>
                            </div>
                            <h1 className="text-2xl font-bold gradient-text">Jobix</h1>
                        </div>
                    )}
                </div>
            </header>
            <main className="max-w-6xl mx-auto space-y-6">
                <Card className="shadow-lg">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start">
                            <div>
                                <CardTitle className="text-3xl font-bold text-slate-900">{project.title}</CardTitle>
                                <Badge className="mt-2">{project.status}</Badge>
                            </div>
                            <div className="text-right mt-4 md:mt-0">
                                <p className="text-sm text-slate-500">Πρόοδος</p>
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="w-32" />
                                    <span className="font-semibold text-slate-700">{Math.round(progress)}%</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><ListTodo/>Εργασίες</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               {['done', 'in_progress', 'todo'].map(status => (
                                    <div key={status}>
                                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                                            {status === 'done' && <CheckCircle2 className="text-emerald-500 w-5 h-5"/>}
                                            {status === 'in_progress' && <History className="text-blue-500 w-5 h-5"/>}
                                            {status === 'todo' && <ListTodo className="text-slate-500 w-5 h-5"/>}
                                            {status === 'done' ? 'Ολοκληρωμένες' : status === 'in_progress' ? 'Σε Εξέλιξη' : 'Προς Υλοποίηση'}
                                        </h3>
                                        <div className="space-y-2">
                                            {taskGroups[status].map(task => (
                                                <div key={task.id} className="p-3 rounded-lg bg-slate-50 border flex items-center gap-3">
                                                    <CheckCircle2 className={`w-5 h-5 ${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300'}`} />
                                                    <span className={`${task.status === 'done' ? 'line-through text-slate-500' : ''}`}>{task.title}</span>
                                                </div>
                                            ))}
                                            {taskGroups[status].length === 0 && <p className="text-sm text-slate-400 pl-4">-</p>}
                                        </div>
                                    </div>
                               ))}
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader><CardTitle>Συλλογή Αρχείων</CardTitle></CardHeader>
                             <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {files.filter(f => f.type.startsWith('image/')).map(file => (
                                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer">
                                        <img src={file.url} alt={file.name} className="w-full h-32 object-cover rounded-lg shadow-md hover:scale-105 transition-transform" />
                                    </a>
                                ))}
                                {files.filter(f => f.type.startsWith('image/')).length === 0 && <p className="col-span-full text-sm text-slate-500">Δεν υπάρχουν φωτογραφίες.</p>}
                             </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>Οικονομικά Στοιχεία</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <p className="text-sm text-slate-500">Συνολικό Κόστος</p>
                                    <p className="text-2xl font-bold text-slate-800">€{totalAmount.toLocaleString('el-GR')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Πληρωθέντα</p>
                                    <p className="text-2xl font-bold text-emerald-600">€{paidAmount.toLocaleString('el-GR')}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Υπόλοιπο</p>
                                    <p className="text-2xl font-bold text-red-600">€{outstandingAmount.toLocaleString('el-GR')}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
             <footer className="text-center text-sm text-slate-500 mt-8">
                <p>Powered by Jobix</p>
            </footer>
        </div>
    );
}


import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { User, Task, Project, Client, Appointment } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, isSameDay, startOfToday, compareAsc } from 'date-fns';
import { el } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Loader2, FolderKanban, Briefcase, Plus, Phone, MoreVertical, Edit, Trash2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import NewAppointmentDialog from '../components/agenda/NewAppointmentDialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge"; // Assuming Badge component path

export default function Agenda() {
    const [agendaItems, setAgendaItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState(null);
    const [deleteAppointmentId, setDeleteAppointmentId] = useState(null);
    const { toast } = useToast();

    const loadAgendaData = useCallback(async () => {
        setIsLoading(true);
        try {
            const currentUser = await User.me();
            if (!currentUser?.organization_id) {
                toast({ title: "Σφάλμα", description: "Δεν βρέθηκε οργανισμός.", variant: "destructive" });
                setIsLoading(false);
                return;
            }
            const orgId = currentUser.organization_id;

            const [tasksData, projectsData, clientsData, appointmentsData] = await Promise.all([
                Task.filter({ organization_id: orgId }),
                Project.filter({ organization_id: orgId }),
                Client.filter({ organization_id: orgId }),
                Appointment.filter({ organization_id: orgId })
            ]);

            const projectLookup = projectsData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
            const clientLookup = clientsData.reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
            
            const today = startOfToday();

            const tasks = tasksData
                .filter(task => task.due_date && new Date(task.due_date) >= today)
                .map(task => ({
                    id: `task-${task.id}`,
                    type: 'task',
                    date: task.due_date,
                    title: task.title,
                    project: projectLookup[task.project_id],
                    client: projectLookup[task.project_id] ? clientLookup[projectLookup[task.project_id].client_id] : null,
                    location: task.location
                }));

            const appointments = appointmentsData
                .filter(appt => appt.appointment_date && new Date(appt.appointment_date) >= today)
                .map(appt => ({
                    id: `appt-${appt.id}`,
                    type: 'appointment',
                    date: appt.appointment_date,
                    title: `Ραντεβού με ${appt.name}`,
                    name: appt.name,
                    phone: appt.phone,
                    address: appt.address,
                    notes: appt.notes,
                    originalData: appt // Keep original appointment data for editing
                }));
            
            const allItems = [...tasks, ...appointments].sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));
            
            setAgendaItems(allItems);

        } catch (error) {
            console.error("Error loading agenda data:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης δεδομένων ατζέντας.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadAgendaData();
    }, [loadAgendaData]);

    const handleEditAppointment = (appointment) => {
        setEditingAppointment(appointment.originalData);
        setIsDialogOpen(true);
    };

    const handleDeleteAppointment = async (appointmentId) => {
        try {
            const realId = appointmentId.replace('appt-', '');
            await Appointment.delete(realId);
            toast({ title: "Επιτυχία!", description: "Το ραντεβού διαγράφηκε." });
            loadAgendaData();
        } catch (error) {
            console.error("Error deleting appointment:", error);
            toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής ραντεβού.", variant: "destructive" });
        }
    };

    const groupedItems = agendaItems.reduce((acc, item) => {
        const date = format(parseISO(item.date), 'yyyy-MM-dd');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(item);
        return acc;
    }, {});
    
    const todayDateString = format(startOfToday(), 'yyyy-MM-dd');

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 flex justify-center items-center h-[calc(100vh-200px)]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <>
            <NewAppointmentDialog 
                open={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setEditingAppointment(null);
                }}
                existingAppointment={editingAppointment}
                onAppointmentCreated={() => {
                    setIsDialogOpen(false);
                    setEditingAppointment(null);
                    loadAgendaData();
                }}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteAppointmentId} onOpenChange={() => setDeleteAppointmentId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Διαγραφή Ραντεβού</AlertDialogTitle>
                        <AlertDialogDescription>
                            Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το ραντεβού; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Άκυρο</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                handleDeleteAppointment(deleteAppointmentId);
                                setDeleteAppointmentId(null);
                            }}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Διαγραφή
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="p-4 md:p-8 space-y-6">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
                                <Calendar className="w-7 h-7 text-blue-600"/>
                                Η Ατζέντα μου
                            </h1>
                            <p className="text-slate-600">Τα προγραμματισμένα ραντεβού και οι εργασίες σας.</p>
                        </div>
                        <Button onClick={() => setIsDialogOpen(true)} className="gradient-bg text-white w-full sm:w-auto">
                            <Plus className="w-4 h-4 mr-2"/>
                            Νέο Ραντεβού
                        </Button>
                    </div>

                    {Object.keys(groupedItems).length === 0 ? (
                         <Card className="text-center py-12 bg-white/70 backdrop-blur-sm shadow-lg">
                            <CardContent>
                               <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg md:text-xl font-semibold text-slate-600 mb-2">
                                    Η ατζέντα σας είναι κενή
                                </h3>
                                <p className="text-sm md:text-base text-slate-500">
                                    Προσθέστε εργασίες με ημερομηνία ή νέα ραντεβού για να εμφανιστούν εδώ.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Accordion type="single" collapsible defaultValue={todayDateString} className="w-full space-y-2">
                            {Object.entries(groupedItems).map(([date, dayItems]) => {
                                const formattedDate = format(parseISO(date), "EEEE, dd MMMM yyyy", { locale: el });
                                const isToday = isSameDay(parseISO(date), new Date());
                                return (
                                    <AccordionItem value={date} key={date} className="bg-white/60 backdrop-blur-sm rounded-xl border shadow-md">
                                        <AccordionTrigger className={`px-4 py-3 text-left hover:no-underline rounded-t-xl ${isToday ? 'text-blue-600 font-bold' : 'text-slate-800 font-semibold'}`}>
                                            <div className="flex items-center justify-between w-full">
                                                <span>{formattedDate}</span>
                                                <Badge variant="secondary">{dayItems.length} {dayItems.length === 1 ? 'Εγγραφή' : 'Εγγραφές'}</Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-4 border-t">
                                            <div className="space-y-4">
                                                {dayItems.map(item => (
                                                    <Card key={item.id} className={`bg-white shadow-sm border-l-4 ${item.type === 'task' ? 'border-purple-500' : 'border-blue-500'}`}>
                                                        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                                                            <div className="w-full md:w-24 text-center md:text-right border-b md:border-b-0 md:border-r pr-4 pb-2 md:pb-0 flex-shrink-0">
                                                                <p className="text-lg font-bold text-slate-800 flex items-center justify-center md:justify-end gap-1">
                                                                    <Clock className="w-5 h-5 text-slate-500"/>
                                                                    {format(parseISO(item.date), 'HH:mm')}
                                                                </p>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                                                                    {item.type === 'appointment' && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                                    <MoreVertical className="h-4 w-4" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuItem onClick={() => handleEditAppointment(item)}>
                                                                                    <Edit className="w-4 h-4 mr-2" />
                                                                                    Επεξεργασία
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuItem 
                                                                                    onClick={() => setDeleteAppointmentId(item.id)}
                                                                                    className="text-red-600"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                                    Διαγραφή
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-slate-500 space-y-1">
                                                                    {item.type === 'task' ? (
                                                                        <>
                                                                            {item.project && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <FolderKanban className="w-4 h-4 text-purple-500"/>
                                                                                    <span>Έργο: </span>
                                                                                    <Link to={createPageUrl('ProjectView') + `?id=${item.project.id}`} className="text-blue-600 hover:underline font-medium">
                                                                                        {item.project.title}
                                                                                    </Link>
                                                                                </div>
                                                                            )}
                                                                            {item.client && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <User className="w-4 h-4 text-slate-400"/>
                                                                                    <span>Πελάτης: {item.client.name}</span>
                                                                                </div>
                                                                            )}
                                                                             {item.location && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <MapPin className="w-4 h-4 text-slate-400"/>
                                                                                    <span>Τοποθεσία: {item.location}</span>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <div className="flex items-center gap-2">
                                                                                <Briefcase className="w-4 h-4 text-blue-500"/>
                                                                                <span className="font-medium text-slate-800">{item.name}</span>
                                                                            </div>
                                                                             {item.phone && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Phone className="w-4 h-4 text-slate-400"/>
                                                                                    <span>{item.phone}</span>
                                                                                </div>
                                                                            )}
                                                                             {item.address && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <MapPin className="w-4 h-4 text-slate-400"/>
                                                                                    <span>{item.address}</span>
                                                                                </div>
                                                                            )}
                                                                             {item.notes && (
                                                                                <div className="text-xs text-slate-400 mt-2 italic">
                                                                                    {item.notes}
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    )}
                </div>
            </div>
        </>
    );
}

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarPlus, User, Phone, MapPin, Edit } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Appointment, User as AuthUser } from "@/api/entities";
import { format } from 'date-fns';

export default function NewAppointmentDialog({ open, onClose, onAppointmentCreated, existingAppointment }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    const [appointment, setAppointment] = useState({
        name: '',
        phone: '',
        address: '',
        date: '',
        time: '',
        notes: ''
    });

    // Populate form when editing existing appointment
    useEffect(() => {
        if (existingAppointment) {
            const appointmentDate = new Date(existingAppointment.appointment_date);
            setAppointment({
                name: existingAppointment.name || '',
                phone: existingAppointment.phone || '',
                address: existingAppointment.address || '',
                date: format(appointmentDate, 'yyyy-MM-dd'),
                time: format(appointmentDate, 'HH:mm'),
                notes: existingAppointment.notes || ''
            });
        } else {
            resetForm();
        }
    }, [existingAppointment]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setAppointment(prev => ({ ...prev, [name]: value }));
    };

    // Σημερινή ημερομηνία σε μορφή yyyy-MM-dd (τοπική ώρα, όχι UTC).
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    // Αν η επιλεγμένη ημερομηνία είναι σήμερα, η ώρα δεν μπορεί να είναι στο παρελθόν.
    const minTimeForToday = appointment.date === todayStr ? format(new Date(), 'HH:mm') : undefined;

    const resetForm = () => {
         setAppointment({
            name: '',
            phone: '',
            address: '',
            date: '',
            time: '',
            notes: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!appointment.name.trim() || !appointment.date) {
            toast({
                title: "Σφάλμα",
                description: "Το όνομα και η ημερομηνία είναι υποχρεωτικά.",
                variant: "destructive"
            });
            return;
        }

        // Έλεγχος ότι το ραντεβού δεν είναι στο παρελθόν (μόνο για νέα ραντεβού —
        // ένα υπάρχον παλιό ραντεβού πρέπει να μπορεί να επεξεργαστεί/διορθωθεί).
        const timeToCheck = appointment.time || '09:00';
        const chosen = new Date(`${appointment.date}T${timeToCheck}:00`);
        if (!existingAppointment && chosen.getTime() < Date.now()) {
            toast({
                title: "Μη έγκυρη ώρα",
                description: "Δεν μπορείτε να κλείσετε ραντεβού σε ώρα που έχει ήδη περάσει.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        try {
            const user = await AuthUser.me();
            
            if (!user.organization_id) {
                toast({
                    title: "Σφάλμα Οργάνωσης",
                    description: "Δεν βρέθηκε οργάνωση. Παρακαλώ δημιουργήστε μια από τις ρυθμίσεις.",
                    variant: "destructive"
                });
                setIsLoading(false);
                return;
            }

            const timePart = appointment.time || '09:00'; // Default time if not provided
            const appointment_date = new Date(`${appointment.date}T${timePart}:00`).toISOString();

            const appointmentData = {
                organization_id: user.organization_id,
                name: appointment.name,
                phone: appointment.phone,
                address: appointment.address,
                appointment_date,
                notes: appointment.notes,
                status: 'scheduled'
            };

            if (existingAppointment) {
                // Update existing appointment
                await Appointment.update(existingAppointment.id, appointmentData);
                toast({
                    title: "Επιτυχία!",
                    description: "Το ραντεβού ενημερώθηκε."
                });
            } else {
                // Create new appointment
                await Appointment.create(appointmentData);
                toast({
                    title: "Επιτυχία!",
                    description: "Το ραντεβού δημιουργήθηκε."
                });
            }

            resetForm();
            onAppointmentCreated();

        } catch (error) {
            console.error('Error saving appointment:', error);
            toast({
                title: "Σφάλμα",
                description: existingAppointment ? "Αποτυχία ενημέρωσης ραντεβού." : "Αποτυχία δημιουργίας ραντεβού.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {existingAppointment ? (
                            <>
                                <Edit className="w-6 h-6 text-blue-600"/>
                                Επεξεργασία Ραντεβού
                            </>
                        ) : (
                            <>
                                <CalendarPlus className="w-6 h-6 text-blue-600"/>
                                Νέο Ραντεβού
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Όνομα Υποψήφιου Πελάτη *</Label>
                        <Input
                            id="name"
                            name="name"
                            value={appointment.name}
                            onChange={handleInputChange}
                            placeholder="π.χ. Νίκος Γεωργίου"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Τηλέφωνο</Label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={appointment.phone}
                                onChange={handleInputChange}
                                placeholder="π.χ. 6912345678"
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="address">Διεύθυνση</Label>
                            <Input
                                id="address"
                                name="address"
                                value={appointment.address}
                                onChange={handleInputChange}
                                placeholder="π.χ. Αριστοτέλους 15, Αθήνα"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="date">Ημερομηνία *</Label>
                            <Input
                                id="date"
                                name="date"
                                type="date"
                                min={existingAppointment ? undefined : todayStr}
                                value={appointment.date}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="time">Ώρα</Label>
                            <Input
                                id="time"
                                name="time"
                                type="time"
                                min={existingAppointment ? undefined : minTimeForToday}
                                value={appointment.time}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>
                   
                    <div className="space-y-2">
                        <Label htmlFor="notes">Σημειώσεις</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            value={appointment.notes}
                            onChange={handleInputChange}
                            placeholder="Πληροφορίες για το ραντεβού, τοποθεσία, κλπ."
                            className="h-24"
                        />
                    </div>

                    <DialogFooter className="mt-6 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                            Άκυρο
                        </Button>
                        <Button type="submit" disabled={isLoading} className="gradient-bg text-white w-full sm:w-auto">
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {existingAppointment ? 'Ενημέρωση' : 'Δημιουργία'} Ραντεβού
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
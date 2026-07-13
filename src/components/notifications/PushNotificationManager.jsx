import React, { useEffect } from 'react';
import { User, Appointment } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";

const PushNotificationManager = () => {
    const { toast } = useToast();

    useEffect(() => {
        const initializeNotifications = async () => {
            // Απλή προσέγγιση με browser notifications
            if (!('Notification' in window)) {
                console.log('This browser does not support notifications');
                return;
            }

            try {
                // Ζητάμε άδεια για notifications
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    toast({
                        title: "Ειδοποιήσεις",
                        description: "Για να λαμβάνετε υπενθυμίσεις ραντεβού, ενεργοποιήστε τις ειδοποιήσεις.",
                        variant: "destructive"
                    });
                    return;
                }

                // Ενεργοποιούμε το σύστημα ειδοποιήσεων
                await scheduleAppointmentNotifications();

                toast({
                    title: "Επιτυχία!",
                    description: "Οι ειδοποιήσεις ραντεβού ενεργοποιήθηκαν. Θα λαμβάνετε υπενθυμίσεις όταν η εφαρμογή είναι ανοιχτή.",
                    duration: 5000
                });

            } catch (error) {
                console.error('Error setting up notifications:', error);
                toast({
                    title: "Σφάλμα", 
                    description: "Δεν ήταν δυνατή η ενεργοποίηση των ειδοποιήσεων.",
                    variant: "destructive"
                });
            }
        };

        const scheduleAppointmentNotifications = async () => {
            try {
                const currentUser = await User.me();
                if (!currentUser?.organization_id) return;

                const appointments = await Appointment.filter({ 
                    organization_id: currentUser.organization_id,
                    status: 'scheduled'
                });

                const now = new Date();

                appointments.forEach(appt => {
                    const appointmentDate = new Date(appt.appointment_date);
                    const notificationTime = new Date(appointmentDate.getTime() - 30 * 60 * 1000); // 30 λεπτά πριν

                    if (notificationTime > now) {
                        const delay = notificationTime.getTime() - now.getTime();
                        
                        setTimeout(() => {
                            if (Notification.permission === 'granted') {
                                const notification = new Notification('Υπενθύμιση Ραντεβού', {
                                    body: `Το ραντεβού σας με "${appt.name}" είναι σε 30 λεπτά!`,
                                    icon: '/logo.svg',
                                    tag: `appointment-${appt.id}`,
                                    requireInteraction: true,
                                });

                                // Όταν κάνουν click στην ειδοποίηση
                                notification.onclick = function() {
                                    window.focus();
                                    window.location.href = '/agenda';
                                    this.close();
                                };

                                // Αυτόματο κλείσιμο μετά από 10 δευτερόλεπτα
                                setTimeout(() => notification.close(), 10000);
                            }
                        }, delay);

                        console.log(`Προγραμματίστηκε ειδοποίηση για ραντεβού "${appt.name}" σε ${Math.round(delay / 1000 / 60)} λεπτά`);
                    }
                });
            } catch (error) {
                console.error('Error scheduling notifications:', error);
            }
        };

        // Εκκινούμε το σύστημα μετά από μικρή καθυστέρηση
        const timeoutId = setTimeout(initializeNotifications, 2000);
        
        return () => clearTimeout(timeoutId);
    }, [toast]);

    return null;
};

export default PushNotificationManager;
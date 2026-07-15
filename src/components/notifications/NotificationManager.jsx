import React, { useEffect, useState } from 'react';
import { Appointment, User } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';

const NotificationManager = () => {
    const { toast } = useToast();
    const [scheduledNotifications, setScheduledNotifications] = useState(new Set());

    useEffect(() => {
        const requestPermission = async () => {
            if ('Notification' in window && Notification.permission !== 'granted') {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    console.log('Notification permission not granted.');
                    toast({
                        title: "Οι ειδοποιήσεις δεν ενεργοποιήθηκαν",
                        description: "Για να λαμβάνετε υπενθυμίσεις, πρέπει να δώσετε άδεια για ειδοποιήσεις από τις ρυθμίσεις του browser.",
                        variant: "destructive"
                    });
                }
            }
        };

        requestPermission();
    }, [toast]);

    useEffect(() => {
        const scheduleNotificationsForAppointments = async () => {
            if (Notification.permission !== 'granted') {
                return;
            }

            try {
                const currentUser = await User.me();
                if (!currentUser?.organization_id) return;

                const appointments = await Appointment.filter({ organization_id: currentUser.organization_id });
                const now = new Date();

                appointments.forEach(appt => {
                    const appointmentId = `appt-${appt.id}`;
                    if (scheduledNotifications.has(appointmentId)) {
                        return; // Already scheduled
                    }

                    const appointmentDate = new Date(appt.appointment_date);
                    const notificationTime = new Date(appointmentDate.getTime() - 30 * 60 * 1000);

                    // Check if the notification time is in the future
                    if (notificationTime > now) {
                        const delay = notificationTime.getTime() - now.getTime();

                        setTimeout(() => {
                            const formattedTime = format(appointmentDate, 'HH:mm');
                            new Notification('Υπενθύμιση Ραντεβού', {
                                body: `Το ραντεβού σας με "${appt.name}" είναι στις ${formattedTime}!`,
                                icon: '/icon-192.png' // App logo
                            });
                        }, delay);

                        // Add to scheduled set to prevent duplicates
                        setScheduledNotifications(prev => new Set(prev).add(appointmentId));
                    }
                });
            } catch (error) {
                console.error("Failed to schedule notifications:", error);
            }
        };

        // Run on mount and then every 5 minutes to catch new appointments
        scheduleNotificationsForAppointments();
        const intervalId = setInterval(scheduleNotificationsForAppointments, 5 * 60 * 1000); 

        return () => clearInterval(intervalId);
    }, [scheduledNotifications]);

    return null; // This is a non-visual component
};

export default NotificationManager;
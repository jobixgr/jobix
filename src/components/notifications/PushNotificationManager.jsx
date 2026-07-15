import React, { useEffect } from 'react';
import { User, Appointment } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";

// Module-level flags: επιβιώνουν σε αλλαγές σελίδας (το Layout ξαναφορτώνει,
// αλλά το module μένει στη μνήμη). Έτσι το toast ΔΕΝ ξαναπετάγεται σε κάθε καρτέλα.
let hasInitialized = false;
const scheduledTimers = new Map(); // appointmentId -> [timerIds]

const PushNotificationManager = () => {
    const { toast } = useToast();

    useEffect(() => {
        // Τρέχει ΜΟΝΟ μία φορά ανά session, όχι σε κάθε αλλαγή σελίδας.
        if (hasInitialized) return;
        hasInitialized = true;

        const scheduleAppointmentNotifications = async () => {
            try {
                const currentUser = await User.me();
                if (!currentUser?.organization_id) return;

                const appointments = await Appointment.filter({
                    organization_id: currentUser.organization_id,
                    status: 'scheduled'
                });

                const now = Date.now();

                appointments.forEach(appt => {
                    if (scheduledTimers.has(appt.id)) return; // ήδη προγραμματισμένο

                    const apptTime = new Date(appt.appointment_date).getTime();
                    if (Number.isNaN(apptTime)) return;

                    const timers = [];

                    const fire = (title, body) => {
                        if (Notification.permission !== 'granted') return;
                        const n = new Notification(title, {
                            body,
                            icon: '/icon-192.png',
                            tag: `appointment-${appt.id}-${title}`,
                            requireInteraction: true,
                        });
                        n.onclick = function () {
                            window.focus();
                            window.location.href = '/agenda';
                            this.close();
                        };
                        setTimeout(() => n.close(), 15000);
                    };

                    // 1) Υπενθύμιση 30 λεπτά πριν (αν προλαβαίνουμε)
                    const reminderAt = apptTime - 30 * 60 * 1000;
                    if (reminderAt > now) {
                        timers.push(setTimeout(
                            () => fire('Υπενθύμιση Ραντεβού', `Το ραντεβού με "${appt.name}" είναι σε 30 λεπτά!`),
                            reminderAt - now
                        ));
                    }

                    // 2) Ειδοποίηση ΤΗΝ ΩΡΑ του ραντεβού — αυτό έλειπε.
                    //    Καλύπτει και ραντεβού που κλείνονται σε λιγότερο από 30'.
                    if (apptTime > now) {
                        timers.push(setTimeout(
                            () => fire('Ώρα Ραντεβού', `Το ραντεβού με "${appt.name}" είναι τώρα!`),
                            apptTime - now
                        ));
                    }

                    if (timers.length) scheduledTimers.set(appt.id, timers);
                });
            } catch (error) {
                console.error('Error scheduling notifications:', error);
            }
        };

        const initializeNotifications = async () => {
            if (!('Notification' in window)) return;

            // Αν ο χρήστης έχει ΗΔΗ δώσει άδεια, απλώς προγραμμάτισε — χωρίς toast.
            if (Notification.permission === 'granted') {
                await scheduleAppointmentNotifications();
                return;
            }

            // Αν έχει ήδη αρνηθεί, μην τον ενοχλείς ξανά.
            if (Notification.permission === 'denied') return;

            // Πρώτη φορά: ζήτα άδεια.
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    await scheduleAppointmentNotifications();
                    // Toast μόνο την ΠΡΩΤΗ φορά που δίνεται η άδεια.
                    toast({
                        title: "Ειδοποιήσεις ενεργές",
                        description: "Θα λαμβάνετε υπενθυμίσεις για τα ραντεβού σας.",
                        duration: 4000
                    });
                }
            } catch (error) {
                console.error('Error setting up notifications:', error);
            }
        };

        const timeoutId = setTimeout(initializeNotifications, 2000);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // κενό dependency array: τρέχει μία φορά

    return null;
};

export default PushNotificationManager;

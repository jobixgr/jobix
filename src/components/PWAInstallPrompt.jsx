import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";

// This component is now a non-visual manager for the PWA install prompt.
const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent the browser's default install prompt
            e.preventDefault();
            console.log("✅ 'beforeinstallprompt' event captured.");
            // Store the event so it can be triggered later.
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Expose the install function globally so the Settings page can call it
        window.promptPWAInstall = async () => {
            if (!deferredPrompt) {
                toast({
                    title: "Η Εγκατάσταση δεν είναι διαθέσιμη",
                    description: "Η εφαρμογή έχει ήδη εγκατασταθεί ή το πρόγραμμα περιήγησης δεν την υποστηρίζει.",
                    variant: "default"
                });
                return;
            }

            // Show the browser's install prompt.
            // 'deferredPrompt' is the original event object with the .prompt() method.
            deferredPrompt.prompt();

            // Wait for the user to respond to the prompt.
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                toast({
                    title: "Επιτυχία!",
                    description: "Η εφαρμογή εγκαταστάθηκε με επιτυχία."
                });
            }

            // We can only use the prompt once, so clear it.
            setDeferredPrompt(null);
        };

        const handleAppInstalled = () => {
            console.log("✅ PWA installed successfully.");
            // Clear the deferred prompt, so we don't show the install button again.
            setDeferredPrompt(null);
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            // Clean up the global function when the component unmounts
            delete window.promptPWAInstall;
        };
    }, [deferredPrompt, toast]);

    // This component does not render any UI itself. It's a manager.
    return null;
};

export default PWAInstallPrompt;
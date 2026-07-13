
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Client, User } from "@/api/entities";

export default function NewClientDialog({ open, onClose, onClientCreated }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    const [client, setClient] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        address: '',
        afm: '', 
        doy: '', 
        profession: '', 
        postal_code: '', 
        city: '', 
        country: 'Ελλάδα', 
        notes: ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setClient(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!client.name.trim()) {
            toast({
                title: "Σφάλμα",
                description: "Το όνομα του πελάτη είναι υποχρεωτικό.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        try {
            const user = await User.me();
            
            if (!user.organization_id) {
                toast({
                    title: "Σφάλμα",
                    description: "Δεν βρέθηκε οργάνωση. Παρακαλώ δημιουργήστε μια οργάνωση πρώτα.",
                    variant: "destructive"
                });
                setIsLoading(false);
                return;
            }

            const newClient = await Client.create({
                ...client,
                organization_id: user.organization_id
            });

            toast({
                title: "Επιτυχία!",
                description: "Ο νέος πελάτης δημιουργήθηκε."
            });

            // Reset form
            setClient({
                name: '',
                company: '',
                phone: '',
                email: '',
                address: '',
                afm: '', 
                doy: '', 
                profession: '', 
                postal_code: '', 
                city: '', 
                country: 'Ελλάδα', 
                notes: ''
            });

            onClientCreated(newClient);

        } catch (error) {
            console.error('Error creating client:', error);
            toast({
                title: "Σφάλμα",
                description: "Αποτυχία δημιουργίας πελάτη. Προσπαθήστε ξανά.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setClient({
            name: '',
            company: '',
            phone: '',
            email: '',
            address: '',
            afm: '', 
            doy: '', 
            profession: '', 
            postal_code: '', 
            city: '', 
            country: 'Ελλάδα', 
            notes: ''
        });
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Νέος Πελάτης</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Βασικά Στοιχεία */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="name">Όνομα *</Label>
                            <Input
                                id="name"
                                name="name"
                                value={client.name}
                                onChange={handleInputChange}
                                placeholder="π.χ. Γιάννης Παπαδόπουλος"
                                required
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="company">Εταιρεία</Label>
                            <Input
                                id="company"
                                name="company"
                                value={client.company}
                                onChange={handleInputChange}
                                placeholder="π.χ. Παπαδόπουλος Α.Ε."
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="phone">Τηλέφωνο</Label>
                            <Input
                                id="phone"
                                name="phone"
                                type="tel"
                                value={client.phone}
                                onChange={handleInputChange}
                                placeholder="π.χ. 6987654321"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={client.email}
                                onChange={handleInputChange}
                                placeholder="π.χ. info@company.com"
                            />
                        </div>
                    </div>

                    {/* ΝΕΑ ΠΡΟΣΘΗΚΗ: Φορολογικά Στοιχεία */}
                    <hr className="my-4" />
                    <h4 className="font-semibold text-slate-700 mb-3">Φορολογικά Στοιχεία (Προαιρετικά)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="afm">ΑΦΜ</Label>
                            <Input
                                id="afm"
                                name="afm"
                                value={client.afm}
                                onChange={handleInputChange}
                                placeholder="π.χ. 123456789"
                                maxLength={9}
                            />
                        </div>
                        <div>
                            <Label htmlFor="doy">ΔΟΥ</Label>
                            <Input
                                id="doy"
                                name="doy"
                                value={client.doy}
                                onChange={handleInputChange}
                                placeholder="π.χ. Α' Αθηνών"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="profession">Επάγγελμα</Label>
                            <Input
                                id="profession"
                                name="profession"
                                value={client.profession}
                                onChange={handleInputChange}
                                placeholder="π.χ. Εμπορικές επιχειρήσεις"
                            />
                        </div>
                    </div>

                    {/* Διεύθυνση */}
                    <hr className="my-4" />
                    <h4 className="font-semibold text-slate-700 mb-3">Διεύθυνση (Προαιρετική)</h4>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="address">Οδός</Label>
                            <Input
                                id="address"
                                name="address"
                                value={client.address}
                                onChange={handleInputChange}
                                placeholder="π.χ. Λεωφ. Κηφισίας 123"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <Label htmlFor="postal_code">Τ.Κ.</Label>
                                <Input
                                    id="postal_code"
                                    name="postal_code"
                                    value={client.postal_code}
                                    onChange={handleInputChange}
                                    placeholder="π.χ. 11741"
                                    maxLength={5}
                                />
                            </div>
                            <div>
                                <Label htmlFor="city">Πόλη</Label>
                                <Input
                                    id="city"
                                    name="city"
                                    value={client.city}
                                    onChange={handleInputChange}
                                    placeholder="π.χ. Αθήνα"
                                />
                            </div>
                            <div>
                                <Label htmlFor="country">Χώρα</Label>
                                <Input
                                    id="country"
                                    name="country"
                                    value={client.country}
                                    onChange={handleInputChange}
                                    placeholder="π.χ. Ελλάδα"
                                />
                            </div>
                        </div>
                    </div>
                    {/* Notes field */}
                    <div>
                        <Label htmlFor="notes">Σημειώσεις</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            value={client.notes}
                            onChange={handleInputChange}
                            placeholder="Προσθέστε τυχόν σημειώσεις για τον πελάτη εδώ..."
                            className="h-20"
                        />
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Άκυρο
                        </Button>
                        <Button type="submit" disabled={isLoading} className="gradient-bg text-white">
                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Δημιουργία
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

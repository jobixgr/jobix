
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Loader2, Users } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { Client, User } from '@/api/entities';

export default function ClientNew() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [user, setUser] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [client, setClient] = useState({
        name: '',
        company: '',
        phone: '',
        email: '',
        address: '',
        afm: '', // ΝΕΑ ΠΡΟΣΘΗΚΗ
        doy: '', // ΝΕΑ ΠΡΟΣΘΗΚΗ
        profession: '', // ΝΕΑ ΠΡΟΣΘΗΚΗ
        postal_code: '', // ΝΕΑ ΠΡΟΣΘΗΚΗ
        city: '', // ΝΕΑ ΠΡΟΣΘΗΚΗ
        country: 'Ελλάδα', // ΝΕΑ ΠΡΟΣΘΗΚΗ
        notes: ''
    });

    const loadUser = useCallback(async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);
            
            if (!currentUser.organization_id) {
                toast({
                    title: "Απαιτείται Οργάνωση",
                    description: "Δημιουργήστε μια οργάνωση από τις Ρυθμίσεις πρώτα.",
                    variant: "destructive"
                });
                navigate(createPageUrl('Settings'));
            }
        } catch (error) {
            console.error('Error loading user:', error);
            toast({
                title: "Σφάλμα",
                description: "Αποτυχία φόρτωσης στοιχείων χρήστη.",
                variant: "destructive"
            });
        }
    }, [toast, navigate]);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

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

        if (!user?.organization_id) {
            toast({
                title: "Σφάλμα",
                description: "Δεν βρέθηκε οργάνωση. Παρακαλώ δημιουργήστε μια οργάνωση πρώτα.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const newClient = await Client.create({
                ...client,
                organization_id: user.organization_id
            });

            toast({
                title: "Επιτυχία!",
                description: "Ο νέος πελάτης δημιουργήθηκε."
            });

            // Navigate to the new client's detail page
            setTimeout(() => {
                navigate(createPageUrl('ClientView') + '?id=' + newClient.id);
            }, 1000);

        } catch (error) {
            console.error('Error creating client:', error);
            toast({
                title: "Σφάλμα",
                description: "Αποτυχία δημιουργίας πελάτη. Προσπαθήστε ξανά.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <Link to={createPageUrl("Clients")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-2">
                            <ArrowLeft className="w-4 h-4" />
                            Επιστροφή στους Πελάτες
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Νέος Πελάτης</h1>
                        <p className="text-slate-600">Προσθήκη νέου πελάτη στη βάση δεδομένων</p>
                    </div>
                </div>

                {/* Form Card */}
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500" />
                            Στοιχεία Πελάτη
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Ονοματεπώνυμο *</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={client.name}
                                        onChange={handleInputChange}
                                        placeholder="π.χ. Γιάννης Παπαδόπουλος"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="company">Εταιρεία</Label>
                                    <Input
                                        id="company"
                                        name="company"
                                        value={client.company}
                                        onChange={handleInputChange}
                                        placeholder="π.χ. Παπαδόπουλος Α.Ε."
                                    />
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Τηλέφωνο</Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        value={client.phone}
                                        onChange={handleInputChange}
                                        placeholder="π.χ. 697 1234567"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={client.email}
                                        onChange={handleInputChange}
                                        placeholder="π.χ. giannis@example.com"
                                    />
                                </div>
                            </div>

                            {/* ΝΕΑ ΠΡΟΣΘΗΚΗ: Φορολογικά Στοιχεία */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Φορολογικά Στοιχεία</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
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
                                    <div className="space-y-2">
                                        <Label htmlFor="doy">ΔΟΥ</Label>
                                        <Input
                                            id="doy"
                                            name="doy"
                                            value={client.doy}
                                            onChange={handleInputChange}
                                            placeholder="π.χ. Α' Αθηνών"
                                        />
                                    </div>
                                    <div className="space-y-2">
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
                            </div>

                            {/* Address */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Διεύθυνση</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="address">Διεύθυνση</Label>
                                        <Input
                                            id="address"
                                            name="address"
                                            value={client.address}
                                            onChange={handleInputChange}
                                            placeholder="π.χ. Λεωφ. Συγγρού 123"
                                        />
                                    </div>
                                    <div className="space-y-2">
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
                                    <div className="space-y-2">
                                        <Label htmlFor="city">Πόλη</Label>
                                        <Input
                                            id="city"
                                            name="city"
                                            value={client.city}
                                            onChange={handleInputChange}
                                            placeholder="π.χ. Αθήνα"
                                        />
                                    </div>
                                    <div className="space-y-2">
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

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label htmlFor="notes">Σημειώσεις</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    value={client.notes}
                                    onChange={handleInputChange}
                                    placeholder="Επιπλέον πληροφορίες για τον πελάτη..."
                                    rows={4}
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex flex-col sm:flex-row justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate(createPageUrl('Clients'))}
                                    disabled={isSaving}
                                >
                                    Ακύρωση
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="gradient-bg text-white"
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Αποθήκευση...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Δημιουργία Πελάτη
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

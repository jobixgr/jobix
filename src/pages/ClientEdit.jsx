import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Client } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function ClientEdit() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [client, setClient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const getClientId = useCallback(() => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }, []);

    const clientId = getClientId();

    useEffect(() => {
        if (!clientId) {
            toast({ title: "Σφάλμα", description: "Δεν βρέθηκε ID πελάτη.", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        const loadClient = async () => {
            setIsLoading(true);
            try {
                const clientData = await Client.get(clientId);
                setClient(clientData);
            } catch (error) {
                console.error("Failed to load client data:", error);
                toast({ title: "Σφάλμα", description: "Δεν βρέθηκε ο πελάτης.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };

        loadClient();
    }, [clientId, toast]);

    const handleSave = async () => {
        if (!client?.name) {
            toast({ title: "Σφάλμα", description: "Το όνομα είναι υποχρεωτικό.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            await Client.update(clientId, { ...client });
            toast({ title: "Επιτυχία", description: "Οι πληροφορίες του πελάτη αποθηκεύτηκαν." });
            navigate(createPageUrl("ClientView") + `?id=${clientId}`);
        } catch (error) {
            console.error("Failed to save client:", error);
            toast({ title: "Σφάλμα", description: "Η αποθήκευση απέτυχε.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setClient(prev => ({ ...prev, [name]: value }));
    };

    if (isLoading) {
        return (
            <div className="p-8">
                <Skeleton className="h-10 w-48 mb-6" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Δεν βρέθηκε πελάτης</h2>
                <Button asChild className="mt-4">
                    <Link to={createPageUrl("Clients")}>Επιστροφή</Link>
                </Button>
            </div>
        );
    }
    
    return (
        <div className="p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => navigate(createPageUrl("ClientView") + `?id=${clientId}`)} className="text-slate-600 pl-0">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Ακύρωση
                    </Button>
                </div>

                <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                    <CardHeader>
                        <CardTitle>Επεξεργασία Στοιχείων Πελάτη</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="name">Ονοματεπώνυμο</Label>
                                <Input id="name" name="name" value={client.name || ''} onChange={handleInputChange} />
                            </div>
                            <div>
                                <Label htmlFor="company">Εταιρεία</Label>
                                <Input id="company" name="company" value={client.company || ''} onChange={handleInputChange} />
                            </div>
                            <div>
                                <Label htmlFor="phone">Τηλέφωνο</Label>
                                <Input id="phone" name="phone" value={client.phone || ''} onChange={handleInputChange} />
                            </div>
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" value={client.email || ''} onChange={handleInputChange} />
                            </div>
                        </div>

                        <hr/>

                        <div>
                          <h4 className="font-semibold text-slate-700 mb-3">Φορολογικά Στοιχεία</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="afm">ΑΦΜ</Label>
                                <Input id="afm" name="afm" value={client.afm || ''} onChange={handleInputChange} placeholder="123456789" maxLength={9} />
                            </div>
                            <div>
                                <Label htmlFor="doy">ΔΟΥ</Label>
                                <Input id="doy" name="doy" value={client.doy || ''} onChange={handleInputChange} placeholder="π.χ. Α' Αθηνών" />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="profession">Επάγγελμα</Label>
                                <Input id="profession" name="profession" value={client.profession || ''} onChange={handleInputChange} placeholder="π.χ. Εμπορικές επιχειρήσεις" />
                            </div>
                          </div>
                        </div>

                        <hr/>
                        
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-3">Διεύθυνση</h4>
                          <div className="space-y-4">
                            <div>
                                <Label htmlFor="address">Οδός & Αριθμός</Label>
                                <Input id="address" name="address" value={client.address || ''} onChange={handleInputChange} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <Label htmlFor="postal_code">Τ.Κ.</Label>
                                  <Input id="postal_code" name="postal_code" value={client.postal_code || ''} onChange={handleInputChange} maxLength={5} />
                              </div>
                              <div>
                                  <Label htmlFor="city">Πόλη</Label>
                                  <Input id="city" name="city" value={client.city || ''} onChange={handleInputChange} />
                              </div>
                            </div>
                            <div>
                                <Label htmlFor="country">Χώρα</Label>
                                <Input id="country" name="country" value={client.country || 'Ελλάδα'} onChange={handleInputChange} />
                            </div>
                          </div>
                        </div>

                        <Button onClick={handleSave} disabled={isSaving} className="w-full gradient-bg text-white">
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                            Αποθήκευση Αλλαγών
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
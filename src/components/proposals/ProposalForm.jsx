import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Euro, Calendar, CheckCircle } from 'lucide-react';

export default function ProposalForm({ proposal, setProposal, clients, onNewClient }) {

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProposal(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setProposal(prev => ({ ...prev, [name]: value }));
    };

    const handleAdvanceChange = (checked) => {
        setProposal(prev => ({
            ...prev,
            has_advance: checked,
            advance_amount: checked ? prev.advance_amount || 0 : 0,
            advance_received_at: checked ? prev.advance_received_at || new Date().toISOString().split('T')[0] : ''
        }));
    };

    const handleAdvanceAmountChange = (e) => {
        const value = parseFloat(e.target.value) || 0;
        setProposal(prev => ({ ...prev, advance_amount: value }));
    };

    return (
        <div className="space-y-6">
            {/* Top Row: Client, Proposal No, Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div>
                    <Label htmlFor="client_id" className="text-sm md:text-base">Πελάτης</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Select
                            name="client_id"
                            value={proposal.client_id}
                            onValueChange={(value) => handleSelectChange('client_id', value)}
                        >
                            <SelectTrigger className="text-sm md:text-base w-full">
                                <SelectValue placeholder="Επιλέξτε πελάτη..." />
                            </SelectTrigger>
                            <SelectContent>
                                {clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={onNewClient} className="flex-shrink-0">
                            <PlusCircle className="w-4 md:w-5 h-4 md:h-5 text-slate-500" />
                        </Button>
                    </div>
                </div>
                <div>
                    <Label htmlFor="number" className="text-sm md:text-base">Αριθμός Προσφοράς</Label>
                    <Input
                        id="number"
                        name="number"
                        value={proposal.number}
                        onChange={handleChange}
                        className="mt-1 text-sm md:text-base w-full"
                        readOnly
                    />
                </div>
                <div>
                    <Label htmlFor="valid_until" className="text-sm md:text-base">Ισχύς έως</Label>
                    <Input
                        id="valid_until"
                        name="valid_until"
                        type="date"
                        value={proposal.valid_until}
                        onChange={handleChange}
                        className="mt-1 text-sm md:text-base w-full"
                    />
                </div>
            </div>

            {/* Title */}
            <div>
                <Label htmlFor="title" className="text-sm md:text-base">Τίτλος Έργου</Label>
                <Input
                    id="title"
                    name="title"
                    value={proposal.title}
                    onChange={handleChange}
                    placeholder="π.χ. Ολική Ανακαίνιση Διαμερίσματος στο Κολωνάκι"
                    className="mt-1 text-sm md:text-lg font-semibold w-full"
                />
            </div>

            {/* Advance Payment Section */}
            <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                        <Euro className="w-5 h-5" />
                        Προκαταβολή
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="has_advance"
                            checked={proposal.has_advance}
                            onCheckedChange={handleAdvanceChange}
                        />
                        <Label htmlFor="has_advance" className="text-sm font-medium">
                            Ο πελάτης έδωσε προκαταβολή
                        </Label>
                    </div>
                    
                    {proposal.has_advance && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                            <div>
                                <Label htmlFor="advance_amount" className="text-sm">Ποσό Προκαταβολής (€)</Label>
                                <Input
                                    id="advance_amount"
                                    type="number"
                                    step="0.01"
                                    value={proposal.advance_amount || ''}
                                    onChange={handleAdvanceAmountChange}
                                    placeholder="0.00"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="advance_received_at" className="text-sm">Ημερομηνία Είσπραξης</Label>
                                <Input
                                    id="advance_received_at"
                                    name="advance_received_at"
                                    type="date"
                                    value={proposal.advance_received_at || ''}
                                    onChange={handleChange}
                                    className="mt-1"
                                />
                            </div>
                        </div>
                    )}

                    {proposal.has_advance && proposal.advance_amount > 0 && (
                        <div className="bg-white border border-green-300 rounded-lg p-3 ml-6">
                            <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle className="w-4 h-4" />
                                <span className="font-semibold">
                                    Προκαταβολή: €{proposal.advance_amount.toLocaleString('el-GR')}
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Description */}
            <div>
                 <Label htmlFor="notes" className="text-sm md:text-base">Περιγραφή / Όροι / Σημειώσεις</Label>
                 <Textarea
                    id="notes"
                    name="notes"
                    value={proposal.notes}
                    onChange={handleChange}
                    placeholder="Αναλυτική περιγραφή των εργασιών, ειδικές συμφωνίες, όροι πληρωμής..."
                    className="mt-1 h-20 md:h-24 text-sm md:text-base w-full"
                />
            </div>
        </div>
    );
}
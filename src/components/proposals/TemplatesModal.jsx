import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ItemTemplate } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from 'lucide-react';

export default function TemplatesModal({ open, onClose, onInsert }) {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedTemplates, setSelectedTemplates] = useState({});

    useEffect(() => {
        if (open) {
            loadTemplates();
        }
    }, [open]);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            const data = await ItemTemplate.list();
            setTemplates(data);
        } catch (error) {
            console.error("Error loading templates:", error);
        }
        setIsLoading(false);
    };

    const { categories, filteredTemplates } = useMemo(() => {
        const cats = [...new Set(templates.map(t => t.work_category))].sort();
        
        let filtered = templates.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === "all" || t.work_category === selectedCategory;
            return matchesSearch && matchesCategory;
        });

        return { categories: cats, filteredTemplates: filtered };
    }, [templates, searchQuery, selectedCategory]);

    const handleSelectTemplate = (templateId, checked) => {
        setSelectedTemplates(prev => {
            const newSelection = { ...prev };
            if (checked) {
                newSelection[templateId] = true;
            } else {
                delete newSelection[templateId];
            }
            return newSelection;
        });
    };
    
    const handleInsert = () => {
        const templatesToInsert = templates.filter(t => selectedTemplates[t.id]);
        onInsert(templatesToInsert);
        setSelectedTemplates({});
    };
    
    const handleClose = () => {
        setSelectedTemplates({});
        setSearchQuery("");
        setSelectedCategory("all");
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>Εισαγωγή από Βιβλιοθήκη Προτύπων</DialogTitle>
                </DialogHeader>
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-1/4 border-r bg-slate-50">
                        <ScrollArea className="h-full p-4">
                            <h3 className="font-semibold text-sm mb-3 px-2">Κατηγορίες</h3>
                            <div className="space-y-1">
                                <Button
                                    variant={selectedCategory === "all" ? "secondary" : "ghost"}
                                    onClick={() => setSelectedCategory("all")}
                                    className="w-full justify-start text-sm"
                                >
                                    Όλες οι Κατηγορίες
                                </Button>
                                {categories.map(cat => (
                                    <Button
                                        key={cat}
                                        variant={selectedCategory === cat ? "secondary" : "ghost"}
                                        onClick={() => setSelectedCategory(cat)}
                                        className="w-full justify-start text-sm"
                                    >
                                        {cat}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                    {/* Main content */}
                    <div className="w-3/4 flex flex-col">
                        <div className="p-4 border-b">
                            <Input
                                placeholder="Αναζήτηση προτύπων..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="flex-1">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <span className="text-2xl">📋</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                        {searchQuery || selectedCategory !== "all" ? "Δεν βρέθηκαν πρότυπα" : "Δεν υπάρχουν πρότυπα"}
                                    </h3>
                                    <p className="text-slate-500 max-w-md">
                                        {searchQuery || selectedCategory !== "all" 
                                            ? "Δοκιμάστε να αλλάξετε τα φίλτρα αναζήτησης ή δημιουργήστε νέα πρότυπα."
                                            : "Δημιουργήστε πρότυπα από τη σελίδα Πρότυπα για γρηγορότερες προσφορές."
                                        }
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white border-b">
                                        <tr>
                                            <th className="p-3 w-12"></th>
                                            <th className="p-3 text-left font-semibold text-slate-600">Τίτλος</th>
                                            <th className="p-3 text-left font-semibold text-slate-600">Κατηγορία</th>
                                            <th className="p-3 text-right font-semibold text-slate-600">Τιμή</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTemplates.map(template => (
                                            <tr key={template.id} className="border-b hover:bg-slate-50">
                                                <td className="p-3 text-center">
                                                    <Checkbox
                                                        checked={!!selectedTemplates[template.id]}
                                                        onCheckedChange={(checked) => handleSelectTemplate(template.id, checked)}
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <p className="font-medium">{template.title}</p>
                                                    <p className="text-xs text-slate-500">{template.description}</p>
                                                </td>
                                                <td className="p-3">
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                                                        {template.work_category}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    €{template.default_price.toFixed(2)} / {template.default_unit}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="p-6 border-t bg-slate-50">
                    <Button variant="outline" onClick={handleClose}>Ακύρωση</Button>
                    <Button 
                        onClick={handleInsert} 
                        className="gradient-bg text-white"
                        disabled={Object.keys(selectedTemplates).length === 0}
                    >
                        Εισαγωγή Επιλεγμένων ({Object.keys(selectedTemplates).length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  BookTemplate, 
  Plus, 
  Search, 
  Edit,
  Trash2,
  FolderPlus,
  Package,
  Hammer,
  Upload
} from "lucide-react";
import { TemplateGroup, ItemTemplate, User, Organization } from "@/api/entities";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Templates() {
  const { toast } = useToast();
  
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialogs state
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState(null);
  
  // Form state
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });
  const [newTemplate, setNewTemplate] = useState({
    group_id: "",
    work_category: "Γενικές Εργασίες",
    kind: "labor",
    title: "",
    description: "",
    default_unit: "τεμ.",
    default_price: "",
    vat_rate: 24
  });

  const loadInitialData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);

      if (!currentUser?.organization_id) {
        setIsLoading(false);
        return;
      }

      const org = await Organization.get(currentUser.organization_id);
      setOrganization(org);
    } catch (error) {
      console.error('Error loading user/org:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!organization) return;
    
    setIsLoading(true);
    try {
      const [groupsData, templatesData] = await Promise.all([
        TemplateGroup.filter({ organization_id: organization.id }, '-created_date'),
        ItemTemplate.filter({ organization_id: organization.id }, '-created_date')
      ]);
      setGroups(groupsData);
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης προτύπων.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [organization, toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (organization) {
      loadData();
    }
  }, [organization, loadData]);

  const handleCreateGroup = async () => {
    if (!organization || !newGroup.name.trim()) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε το όνομα της ομάδας.", variant: "destructive" });
      return;
    }

    try {
      await TemplateGroup.create({
        organization_id: organization.id,
        ...newGroup
      });
      setNewGroup({ name: "", description: "" });
      setShowNewGroup(false);
      toast({ title: "Επιτυχία!", description: "Η ομάδα δημιουργήθηκε." });
      loadData();
    } catch (error) {
      console.error('Error creating group:', error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας ομάδας.", variant: "destructive" });
    }
  };

  const handleCreateTemplate = async () => {
    if (!organization || !newTemplate.title.trim() || !newTemplate.default_price) {
      toast({ title: "Σφάλμα", description: "Συμπληρώστε τίτλο και τιμή.", variant: "destructive" });
      return;
    }

    try {
      await ItemTemplate.create({
        organization_id: organization.id,
        ...newTemplate,
        default_price: parseFloat(newTemplate.default_price)
      });
      setNewTemplate({
        group_id: "",
        work_category: "Γενικές Εργασίες",
        kind: "labor",
        title: "",
        description: "",
        default_unit: "τεμ.",
        default_price: "",
        vat_rate: 24
      });
      setShowNewTemplate(false);
      toast({ title: "Επιτυχία!", description: "Το πρότυπο δημιουργήθηκε." });
      loadData();
    } catch (error) {
      console.error('Error creating template:', error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας προτύπου.", variant: "destructive" });
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await ItemTemplate.delete(templateId);
      toast({ title: "Επιτυχία!", description: "Το πρότυπο διαγράφηκε." });
      loadData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({ title: "Σφάλμα", description: "Αποτυχία διαγραφής προτύπου.", variant: "destructive" });
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = selectedGroup === "all" || template.group_id === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const workCategories = [
    "Γενικές Εργασίες",
    "Υδραυλικά", 
    "Ηλεκτρολογικά",
    "Βαψίματα",
    "Κεραμικά",
    "Ξυλουργικά",
    "Μεταλλικές Κατασκευές",
    "Δομικά Υλικά",
    "Μόνωση",
    "Κήπος & Εξωτερικοί Χώροι",
    "Κλιματισμός & Θέρμανση",
    "Ασφαλτοστρώσεις",
    "Καθαρισμοί",
    "Μεταφορές",
    "Άλλο" 
  ];

  if (!organization) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <BookTemplate className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-600 mb-2">Απαιτείται Οργάνωση</h2>
        <p className="text-slate-500">Δημιουργήστε μια οργάνωση από τις Ρυθμίσεις για να διαχειριστείτε πρότυπα.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Πρότυπα Εργασιών</h1>
            <p className="text-slate-600">Διαχειριστείτε προκατασκευασμένα items για γρήγορη δημιουργία προσφορών</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-slate-600">
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Νέα Ομάδα
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Νέα Ομάδα Προτύπων</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="group-name">Όνομα Ομάδας</Label>
                    <Input
                      id="group-name"
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                      placeholder="π.χ. Ανακαίνιση Μπάνιου"
                    />
                  </div>
                  <div>
                    <Label htmlFor="group-description">Περιγραφή</Label>
                    <Textarea
                      id="group-description"
                      value={newGroup.description}
                      onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                      placeholder="Περιγραφή της ομάδας..."
                    />
                  </div>
                  <Button onClick={handleCreateGroup} className="gradient-bg text-white w-full">
                    Δημιουργία
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
              <DialogTrigger asChild>
                <Button className="gradient-bg text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Νέο Πρότυπο
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Νέο Πρότυπο Item</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Κατηγορία Εργασίας</Label>
                      <Select 
                        value={newTemplate.work_category} 
                        onValueChange={(value) => setNewTemplate({...newTemplate, work_category: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Επιλέξτε κατηγορία" />
                        </SelectTrigger>
                        <SelectContent>
                          {workCategories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Τύπος</Label>
                      <Select value={newTemplate.kind} onValueChange={(value) => setNewTemplate({...newTemplate, kind: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="labor">Εργασία</SelectItem>
                          <SelectItem value="material">Υλικό</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Τίτλος</Label>
                    <Input
                      value={newTemplate.title}
                      onChange={(e) => setNewTemplate({...newTemplate, title: e.target.value})}
                      placeholder="π.χ. Κεραμικά πλακάκια τοίχου"
                    />
                  </div>
                  
                  <div>
                    <Label>Περιγραφή</Label>
                    <Textarea
                      value={newTemplate.description}
                      onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                      placeholder="Λεπτομερή περιγραφή του προτύπου..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Μονάδα</Label>
                      <Input
                        value={newTemplate.default_unit}
                        onChange={(e) => setNewTemplate({...newTemplate, default_unit: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Τιμή (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newTemplate.default_price}
                        onChange={(e) => setNewTemplate({...newTemplate, default_price: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>ΦΠΑ (%)</Label>
                      <Input
                        type="number"
                        value={newTemplate.vat_rate}
                        onChange={(e) => setNewTemplate({...newTemplate, vat_rate: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleCreateTemplate} className="gradient-bg text-white w-full">
                    Δημιουργία
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <Input
                  placeholder="Αναζήτηση προτύπων..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedGroup === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedGroup("all")}
                  className={selectedGroup === "all" ? "gradient-bg text-white" : ""}
                >
                  Όλες οι Ομάδες
                </Button>
                {groups.map((group) => (
                  <Button
                    key={group.id}
                    variant={selectedGroup === group.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedGroup(group.id)}
                    className={selectedGroup === group.id ? "gradient-bg text-white" : ""}
                  >
                    {group.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 bg-slate-200 rounded w-16"></div>
                    <div className="h-8 bg-slate-200 rounded w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredTemplates.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <BookTemplate className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">
                {searchQuery || selectedGroup !== "all" ? "Δεν βρέθηκαν πρότυπα" : "Δεν υπάρχουν πρότυπα ακόμα"}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery || selectedGroup !== "all" 
                  ? "Δοκιμάστε να αλλάξετε τα φίλτρα αναζήτησης"
                  : "Δημιουργήστε το πρώτο σας πρότυπο για να επιταχύνετε τη δημιουργία προσφορών"
                }
              </p>
              {!searchQuery && selectedGroup === "all" && (
                <Button onClick={() => setShowNewTemplate(true)} className="gradient-bg text-white">
                  <Plus className="w-5 h-5 mr-2" />
                  Δημιουργία Προτύπου
                </Button>
              )}
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <Card key={template.id} className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      template.kind === 'material' ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                      {template.kind === 'material' ? (
                        <Package className={`w-4 h-4 ${template.kind === 'material' ? 'text-orange-600' : 'text-blue-600'}`} />
                      ) : (
                        <Hammer className={`w-4 h-4 ${template.kind === 'material' ? 'text-orange-600' : 'text-blue-600'}`} />
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {template.kind === 'material' ? 'Υλικό' : 'Εργασία'}
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-purple-600 transition-colors">
                    {template.title}
                  </h3>
                  
                  <p className="text-xs text-slate-500 mb-2">{template.work_category}</p>
                  
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                    {template.description || 'Χωρίς περιγραφή'}
                  </p>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-slate-500">
                      {template.default_unit} • €{template.default_price?.toFixed(2)}
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => setEditingTemplate(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-red-500"
                        onClick={() => setDeleteTemplateId(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή Προτύπου</AlertDialogTitle>
            <AlertDialogDescription>
              Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το πρότυπο; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleDeleteTemplate(deleteTemplateId);
                setDeleteTemplateId(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Διαγραφή
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

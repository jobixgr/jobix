
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Users, 
  Globe, 
  Plus, 
  Check,
  Loader2,
  AlertCircle,
  Crown,
  Download,
  User as UserIcon, // Changed alias to avoid conflict
  Edit, // Added for editing user info
  Save // Added for saving user info
} from "lucide-react";
import { Organization, User as UserModel } from "@/api/entities";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Cache to prevent multiple API calls
let organizationsCache = null;
let userCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

export default function Settings() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSaving, setIsSaving] = useState(false); 
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const [editableUser, setEditableUser] = useState(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  
  const [newOrg, setNewOrg] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    vat_rate: 24
  });

  const createDefaultOrganization = useCallback(async (currentUser) => {
    try {
      const defaultOrg = await Organization.create({
        name: "Η Εταιρεία μου",
        email: currentUser.email,
        phone: "",
        address: "",
        vat_rate: 24,
        currency: "EUR"
      });

      // Set as active organization for the user
      await UserModel.updateMyUserData({ organization_id: defaultOrg.id });
      localStorage.setItem('active_org_id', defaultOrg.id);
      
      // Update global cache
      organizationsCache = [defaultOrg]; // Only the default organization
      userCache = { ...currentUser, organization_id: defaultOrg.id };
      cacheTimestamp = Date.now();
      
      // Update component state
      setOrganizations([defaultOrg]);
      setActiveOrgId(defaultOrg.id);
      setUser(prev => ({ ...prev, organization_id: defaultOrg.id }));
      setEditableUser(prev => ({ ...prev, organization_id: defaultOrg.id })); // Also update editable user

      toast({ title: "Επιτυχία!", description: "Δημιουργήθηκε προεπιλεγμένη οργάνωση." });
    } catch (error) {
      console.error("Error creating default organization:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας οργάνωσης.", variant: "destructive" });
    }
  }, [toast]);

  const loadUserAndOrganizations = useCallback(async () => {
    setIsLoading(true);
    let currentFetchedUser = null;
    try {
      const now = Date.now();
      
      // Load user from cache or API
      if (userCache && (now - cacheTimestamp) < CACHE_DURATION) {
        currentFetchedUser = userCache;
      } else {
        currentFetchedUser = await UserModel.me();
        userCache = currentFetchedUser; // Update global user cache
      }
      setUser(currentFetchedUser);
      setEditableUser(currentFetchedUser); // Initialize editable user state

      let loadedOrgs = [];
      let activeOrg = null;

      if (currentFetchedUser && currentFetchedUser.organization_id) {
        // CRITICAL CHANGE: Load ONLY the user's active organization
        // Try to get from cache first, ensuring it's the *correct* organization
        if (organizationsCache && organizationsCache.length > 0 && 
            organizationsCache[0].id === currentFetchedUser.organization_id && 
            (now - cacheTimestamp) < CACHE_DURATION) {
          loadedOrgs = organizationsCache;
        } else {
          // No valid cache, fetch only the user's specific organization
          await new Promise(resolve => setTimeout(resolve, 500)); // Delay to prevent rate limiting
          const userOrg = await Organization.get(currentFetchedUser.organization_id);
          if (userOrg) {
            loadedOrgs = [userOrg];
          }
        }
        
        activeOrg = currentFetchedUser.organization_id; // Set activeOrgId from user's data

        // Update global cache for organizations
        organizationsCache = loadedOrgs;
        cacheTimestamp = now; // Update timestamp after potential API call for orgs

      } else {
        // User has no organization_id OR no organization was found.
        // Auto-bootstrap: create default organization.
        await createDefaultOrganization(currentFetchedUser); 
        // createDefaultOrganization handles setting component state (user, organizations, activeOrgId)
        // and updates global caches (userCache, organizationsCache). So, we can exit here.
        return; 
      }

      // If we reached here, it means an organization was either loaded or found in cache
      // and createDefaultOrganization was NOT called.
      setOrganizations(loadedOrgs);
      setActiveOrgId(activeOrg);

    } catch (error) {
      console.error("Error loading user/organizations:", error);
      if (error.response?.status === 429) {
        toast({ title: "Πολλές Αιτήσεις", description: "Παρακαλώ περιμένετε λίγο και δοκιμάστε ξανά.", variant: "destructive" });
      } else {
        toast({ title: "Σφάλμα", description: "Αποτυχία φόρτωσης δεδομένων.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, createDefaultOrganization]);

  useEffect(() => {
    loadUserAndOrganizations();
  }, [loadUserAndOrganizations]);

  const handleSaveUser = async () => {
    const newName = editableUser.full_name;
    if (!newName?.trim()) {
        toast({ title: "Σφάλμα", description: "Το όνομα δεν μπορεί να είναι κενό.", variant: "destructive"});
        return;
    }
    setIsSavingUser(true);
    try {
        // Send update to the backend
        await UserModel.updateMyUserData({ full_name: newName });
        
        // Create the updated user object manually for immediate UI update
        const updatedUserObject = { ...user, full_name: newName };

        // Update local component state
        setUser(updatedUserObject);
        setEditableUser(updatedUserObject);

        // Update the module-level cache to prevent stale data on reload
        userCache = updatedUserObject;
        cacheTimestamp = Date.now();

        // Dispatch a global event to notify other components (like Layout)
        window.dispatchEvent(new Event('userProfileUpdated'));
        
        toast({ title: "Επιτυχία!", description: "Οι πληροφορίες σας ενημερώθηκαν."});
        setIsEditingUser(false);
    } catch(error) {
        console.error("Error updating user:", error);
        toast({ title: "Σφάλμα", description: "Αποτυχία ενημέρωσης.", variant: "destructive"});
        // On error, revert the editable user back to the original state
        setEditableUser({ ...user }); 
    } finally {
        setIsSavingUser(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrg.name.trim()) {
      toast({ title: "Σφάλμα", description: "Το όνομα της οργάνωσης είναι υποχρεωτικό.", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      const createdOrg = await Organization.create({
        ...newOrg,
        vat_rate: parseFloat(newOrg.vat_rate) || 24,
        currency: "EUR"
      });

      // CRITICAL CHANGE: After creating, make this new organization the *active* and only visible one.
      // Update user's active organization_id
      await UserModel.updateMyUserData({ organization_id: createdOrg.id });
      localStorage.setItem('active_org_id', createdOrg.id);
      
      // Update component state
      setOrganizations([createdOrg]); // Only the newly created one will be shown
      setActiveOrgId(createdOrg.id);
      setUser(prev => ({ ...prev, organization_id: createdOrg.id }));
      setEditableUser(prev => ({ ...prev, organization_id: createdOrg.id })); // Also update editable user

      // Update global cache
      organizationsCache = [createdOrg];
      userCache = { ...userCache, organization_id: createdOrg.id }; // Assuming userCache has the current user data
      cacheTimestamp = Date.now();
      
      setNewOrg({ name: "", email: "", phone: "", address: "", vat_rate: 24 });
      setShowCreateForm(false);
      
      toast({ title: "Επιτυχία!", description: "Η οργάνωση δημιουργήθηκε και ορίστηκε ως ενεργή." });
    } catch (error) {
      console.error("Error creating organization:", error);
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας οργάνωσης.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // handleSetActiveOrganization is removed as users can only view and manage their single active organization.
  // The UI no longer presents a choice of multiple organizations to set as active.

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with PWA Info */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Ρυθμίσεις</h1>
          <p className="text-slate-600 mb-4">Διαχειρίσου τις ρυθμίσεις της εφαρμογής και του οργανισμού σου</p>
          
          {/* PWA Status */}
          {window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-800">Εφαρμογή Εγκαταστημένη</h3>
                  <p className="text-emerald-700 text-sm">Το Jobix τρέχει σε PWA mode στη συσκευή σας!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Download className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-800">Εγκαταστήστε το Jobix</h3>
                  <p className="text-blue-700 text-sm">Προσθέστε το στην αρχική οθόνη για καλύτερη εμπειρία</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Call the globally exposed function from PWAInstallPrompt component
                    if (window.promptPWAInstall) {
                      window.promptPWAInstall();
                    } else {
                      // Fallback toast message if the function isn't available
                      toast({
                        title: "Η Εγκατάσταση δεν είναι διαθέσιμη",
                        description: "Η εφαρμογή έχει ήδη εγκατασταθεί ή το πρόγραμμα περιήγησης δεν την υποστηρίζει.",
                        variant: "default"
                      });
                    }
                  }}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Εγκατάσταση
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* User Information Section */}
        {user && (
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-500" />
                  Πληροφορίες Χρήστη
                </CardTitle>
                {!isEditingUser ? (
                  <Button variant="ghost" size="icon" onClick={() => setIsEditingUser(true)} className="h-8 w-8">
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                     <Button variant="ghost" onClick={() => { setIsEditingUser(false); setEditableUser(user); }} disabled={isSavingUser}>
                       Ακύρωση
                     </Button>
                     <Button onClick={handleSaveUser} disabled={isSavingUser} className="gradient-bg text-white">
                       {isSavingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                       Αποθήκευση
                     </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user-name">Όνομα</Label>
                  <Input
                    id="user-name"
                    value={editableUser?.full_name || ''}
                    disabled={!isEditingUser || isSavingUser}
                    onChange={(e) => setEditableUser({...editableUser, full_name: e.target.value})}
                    className={!isEditingUser ? "bg-slate-50" : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    value={user.email || ''}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Ιδιωτικότητα:</strong> Τα δεδομένα σας είναι πλήρως απομονωμένα. 
                  Μόνο εσείς έχετε πρόσβαση στους πελάτες και έργα σας.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="organization" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100">
            <TabsTrigger value="general">
              <Globe className="w-4 h-4 mr-2"/>
              Γενικά
            </TabsTrigger>
            <TabsTrigger value="organization">
              <Building2 className="w-4 h-4 mr-2"/>
              Οργάνωση
            </TabsTrigger>
            <TabsTrigger value="team">
              <Users className="w-4 h-4 mr-2"/>
              Ομάδα
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle>Γενικές Ρυθμίσεις</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Όνομα Εφαρμογής</Label>
                  <Input value="Jobix" disabled className="bg-slate-50" />
                  <p className="text-sm text-slate-500 mt-1">Το όνομα της εφαρμογής δεν μπορεί να αλλάξει</p>
                </div>
                <div>
                  <Label>Γλώσσα</Label>
                  <Input value="Ελληνικά (Ελλάδα)" disabled className="bg-slate-50" />
                </div>
                <div>
                  <Label>Νόμισμα</Label>
                  <Input value="EUR (€)" disabled className="bg-slate-50" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization">
            <div className="space-y-6">
              {organizations.length === 0 ? (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-800">Δεν υπάρχει Οργάνωση</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Δημιουργήστε την πρώτη σας οργάνωση για να ξεκινήσετε.
                  </AlertDescription>
                </Alert>
              ) : (
                <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                  <CardHeader>
                    <CardTitle>Η Οργάνωσή μου</CardTitle> {/* Changed title to singular */}
                  </CardHeader>
                  <CardContent>
                    {/* organizations will always contain at most one item now */}
                    {organizations.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{org.name}</h3>
                            <p className="text-sm text-slate-500">{org.email}</p>
                          </div>
                          {/* Active badge will always be present for the single displayed organization */}
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <Crown className="w-3 h-3 mr-1" />
                            Ενεργή
                          </Badge>
                        </div>
                        {/* The button to "Set as Active" is no longer needed as there's only one org visible */}
                        {/* {activeOrgId !== org.id && ( ... )} */}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Δημιουργία Νέας Οργάνωσης</CardTitle>
                    <Button
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      variant="outline"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {showCreateForm ? "Ακύρωση" : "Νέα Οργάνωση"}
                    </Button>
                  </div>
                </CardHeader>
                {showCreateForm && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="org-name">Όνομα Οργάνωσης</Label>
                        <Input
                          id="org-name"
                          value={newOrg.name}
                          onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                          placeholder="π.χ. Κατασκευαστική Εταιρεία ΑΕ"
                        />
                      </div>
                      <div>
                        <Label htmlFor="org-email">Email</Label>
                        <Input
                          id="org-email"
                          type="email"
                          value={newOrg.email}
                          onChange={(e) => setNewOrg({...newOrg, email: e.target.value})}
                          placeholder="info@company.gr"
                        />
                      </div>
                      <div>
                        <Label htmlFor="org-phone">Τηλέφωνο</Label>
                        <Input
                          id="org-phone"
                          value={newOrg.phone}
                          onChange={(e) => setNewOrg({...newOrg, phone: e.target.value})}
                          placeholder="210 1234567"
                        />
                      </div>
                      <div>
                        <Label htmlFor="org-vat">ΦΠΑ (%)</Label>
                        <Input
                          id="org-vat"
                          type="number"
                          value={newOrg.vat_rate}
                          onChange={(e) => setNewOrg({...newOrg, vat_rate: e.target.value})}
                          placeholder="24"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="org-address">Διεύθυνση</Label>
                      <Textarea
                        id="org-address"
                        value={newOrg.address}
                        onChange={(e) => setNewOrg({...newOrg, address: e.target.value})}
                        placeholder="Διεύθυνση εταιρείας..."
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={handleCreateOrganization}
                      disabled={isCreating}
                      className="gradient-bg text-white w-full"
                    >
                      {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Δημιουργία Οργάνωσης
                    </Button>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team">
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle>Μέλη Ομάδας</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center text-white font-bold">
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'Χ'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user?.full_name || 'Χρήστης'}</p>
                        <p className="text-sm text-slate-500">{user?.email}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <Crown className="w-3 h-3 mr-1" />
                      Διαχειριστής
                    </Badge>
                  </div>
                  
                  <div className="p-6 border-2 border-dashed border-slate-200 rounded-lg text-center">
                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Η προσθήκη μελών θα είναι διαθέσιμη σύντομα</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

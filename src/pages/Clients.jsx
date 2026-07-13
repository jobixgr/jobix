
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail,
  ArrowRight,
  Building2,
  MapPin,
  FileText,
  FolderKanban
} from "lucide-react";
import { Client, User } from "@/api/entities"; // Add User

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    let filtered = clients;
    
    if (searchQuery) {
      filtered = filtered.filter(client => 
        client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone?.includes(searchQuery)
      );
    }
    
    setFilteredClients(filtered);
  }, [clients, searchQuery]);

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser || !currentUser.organization_id) {
        console.warn("No current user or organization_id found. Cannot load clients.");
        setClients([]); // Ensure clients state is cleared if no organization
        setIsLoading(false);
        return;
      }
      const data = await Client.filter({ organization_id: currentUser.organization_id }, '-updated_date');
      console.log('Loaded clients:', data); // Debug log
      setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
      // Optionally handle error state for UI
    }
    setIsLoading(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Πελάτες</h1>
            <p className="text-sm md:text-base text-slate-600">Διαχειρίσου τους πελάτες σου και παρακολούθησε τη συνεργασία σας</p>
          </div>
          <Link to={createPageUrl("ClientNew")}>
            <Button className="gradient-bg text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full md:w-auto">
              <Plus className="w-4 md:w-5 h-4 md:h-5 mr-2" />
              <span className="text-sm md:text-base">Νέος Πελάτης</span>
            </Button>
          </Link>
        </div>

        {/* Search */}
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="relative">
              <Search className="w-4 md:w-5 h-4 md:h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <Input
                placeholder="Αναζήτηση πελατών..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-slate-200 text-sm md:text-base"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg animate-pulse">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-slate-200 rounded w-3/4 mb-1"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredClients.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg md:text-xl font-semibold text-slate-600 mb-2">
                {searchQuery ? "Δεν βρέθηκαν πελάτες" : "Δεν υπάρχουν πελάτες ακόμα"}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery 
                  ? "Δοκίμασε να αλλάξεις τον όρο αναζήτησης"
                  : "Ξεκίνα προσθέτοντας τον πρώτο σου πελάτη"
                }
              </p>
              {!searchQuery && (
                <Link to={createPageUrl("ClientNew")}>
                  <Button className="gradient-bg text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200">
                    <Plus className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                    <span className="text-sm md:text-base">Προσθήκη Πελάτη</span>
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            filteredClients.map((client) => {
              console.log('Rendering client with ID:', client.id); // Debug log
              return (
                <div
                  key={client.id}
                  onClick={() => {
                    console.log('Navigating to client:', client.id); // Debug log
                    navigate(createPageUrl("ClientView") + "?id=" + client.id);
                  }}
                  className="block cursor-pointer"
                >
                  <Card className="bg-white/70 backdrop-blur-sm border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 group h-full">
                    <CardContent className="p-4 md:p-6 flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 gradient-bg rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {client.name?.charAt(0)?.toUpperCase() || 'Π'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-lg group-hover:text-purple-600 transition-colors truncate">
                            {client.name}
                          </h3>
                          {client.company && (
                            <p className="text-slate-600 text-sm truncate">{client.company}</p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600 flex-grow">
                        {client.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="truncate">{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="truncate">{client.email}</span>
                          </div>
                        )}
                        {client.address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="truncate">{client.address}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between gap-2 flex-wrap">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs flex-grow md:flex-grow-0" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigate(createPageUrl('ProposalNew') + `?client_id=${client.id}`); 
                          }}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Νέα Προσφορά
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs flex-grow md:flex-grow-0" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigate(createPageUrl('ProjectNew') + `?client_id=${client.id}`); 
                          }}
                        >
                          <FolderKanban className="w-3 h-3 mr-1" />
                          Νέο Έργο
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

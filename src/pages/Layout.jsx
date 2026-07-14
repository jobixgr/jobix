

import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Users,
  CreditCard,
  Settings,
  Menu,
  Building2,
  ChevronRight,
  Receipt,
  BookTemplate,
  Loader2,
  LogOut,
  User as UserIcon,
  Calendar
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import TrialStatusBanner from "@/components/TrialStatusBanner";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";

import { User, Organization } from "@/api/entities";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    gradient: "from-blue-500 to-blue-600",
    category: "main"
  },
  {
    title: "Ατζέντα",
    url: createPageUrl("Agenda"),
    icon: Calendar,
    gradient: "from-purple-500 to-purple-600",
    category: "main"
  },
  {
    title: "Προσφορές",
    url: createPageUrl("Proposals"),
    icon: FileText,
    gradient: "from-emerald-500 to-emerald-600",
    category: "business"
  },
  {
    title: "Τιμολόγια",
    url: createPageUrl("Invoices"),
    icon: Receipt,
    gradient: "from-orange-500 to-orange-600",
    category: "business"
  },
  {
    title: "Ιστορικό Παραστατικών",
    url: createPageUrl("InvoiceHistory"),
    icon: BookTemplate,
    gradient: "from-amber-500 to-amber-600",
    category: "business"
  },
  {
    title: "Έργα",
    url: createPageUrl("Projects"),
    icon: FolderKanban,
    gradient: "from-indigo-500 to-indigo-600",
    category: "management"
  },
  {
    title: "Πελάτες",
    url: createPageUrl("Clients"),
    icon: Users,
    gradient: "from-pink-500 to-pink-600",
    category: "management"
  },
  {
    title: "Πρότυπα",
    url: createPageUrl("Templates"),
    icon: BookTemplate,
    gradient: "from-teal-500 to-teal-600",
    category: "management"
  },
  {
    title: "Πληρωμές",
    url: createPageUrl("Payments"),
    icon: CreditCard,
    gradient: "from-green-500 to-green-600",
    category: "financial"
  },
  {
    title: "Ρυθμίσεις",
    url: createPageUrl("Settings"),
    icon: Settings,
    gradient: "from-slate-500 to-slate-600",
    category: "system"
  },
];

const categoryLabels = {
  main: "Κεντρικό",
  business: "Επιχείρηση",
  management: "Διαχείριση",
  financial: "Οικονομικά",
  system: "Σύστημα"
};

const publicPages = ['index', 'privacy'];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await User.logout();
      window.location.href = createPageUrl('index');
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = createPageUrl('index');
    }
  };

  const fetchUser = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      console.warn("Failed to fetch user:", error.message);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // PWA setup logic, unchanged
  }, []);

  useEffect(() => {
    const handleAuthRouting = async () => {
      setIsLoading(true);
      
      // 1. Handle Public Pages
      if (publicPages.includes(currentPageName)) {
        // If it's the landing page AND the user IS logged in, redirect to dashboard.
        if (currentPageName === 'index') {
          try {
            const currentUser = await fetchUser();
            if (currentUser) {
              window.location.href = createPageUrl('Dashboard');
              return; // Stop execution
            }
          } catch (e) {
            // Not logged in, so just let them see the landing page.
            console.log("User not logged in, showing landing page.");
          }
        }
        // For /privacy, or for unauthenticated users on /index, just show the page.
        setIsLoading(false);
        return;
      }

      // 2. Handle Protected Pages
      try {
        const currentUser = await fetchUser();

        if (!currentUser) {
          // USER IS NOT LOGGED IN - redirect to /login as requested.
          window.location.href = '/login';
          return;
        }

        // USER IS LOGGED IN - proceed with app logic
        if (currentUser && !currentUser.organization_id && currentPageName !== 'Onboarding') {
          window.location.href = createPageUrl('Onboarding');
          return;
        }
        
        if (currentUser?.role === 'super_admin' && currentPageName !== 'admindashboard') {
          window.location.href = createPageUrl('admindashboard');
          return;
        }
        
        if (currentUser?.organization_id) {
          const org = await Organization.get(currentUser.organization_id);
          setOrganization(org);
        }

      } catch (error) {
        // Any auth error also redirects to login page for protected routes.
        console.error("Auth error on protected route:", error);
        window.location.href = '/login';
        return;
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthRouting();

    const handleProfileUpdate = () => {
      console.log("User profile update detected. Refetching user in Layout.");
      fetchUser();
    };

    window.addEventListener('userProfileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('userProfileUpdated', handleProfileUpdate);
    };

  }, [currentPageName, fetchUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Φόρτωση...</p>
        </div>
      </div>
    );
  }

  if (publicPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  if (currentPageName === 'Onboarding') {
    return <>{children}</>;
  }

  if (currentPageName === 'admindashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {children}
      </div>
    );
  }

  const groupedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <PushNotificationManager />
        <style>{`
          :root {
            --primary: 212 100% 40%; /* #0052CC */
            --primary-foreground: 255 255 255;
          }
          
          .gradient-bg {
            background-image: linear-gradient(135deg, #0052CC 0%, #2684FF 100%);
          }

          .gradient-text {
             background-image: linear-gradient(135deg, #0052CC 0%, #2684FF 100%);
             -webkit-background-clip: text;
             background-clip: text;
             color: transparent;
          }

          .premium-sidebar {
            background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
            border-right: 1px solid #e2e8f0;
            box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);
          }
          
          .premium-group-label {
            font-weight: 700;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #64748b;
            margin-bottom: 0.5rem;
            padding-left: 0.5rem;
          }
          
          .premium-nav-item {
            font-weight: 600;
            font-size: 0.95rem;
            letter-spacing: 0.02em;
            transition: all 0.2s ease;
          }
          
          .premium-nav-item:hover {
            font-weight: 700;
            transform: translateX(2px);
          }
          
          .premium-nav-item.active {
            font-weight: 700;
            color: #0052CC; /* New color */
          }
          
          .premium-user-section {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          }
          
          .user-name {
            font-weight: 700;
            font-size: 0.875rem;
            letter-spacing: 0.01em;
          }
          
          .user-email {
            font-weight: 500;
            font-size: 0.75rem;
            color: #64748b;
            letter-spacing: 0.01em;
          }
          
          .logout-button {
            font-weight: 600;
            font-size: 0.875rem;
            letter-spacing: 0.02em;
          }
        `}</style>

        <SidebarProvider>
          <div className="flex">
            <Sidebar className="premium-sidebar">
              <SidebarHeader className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <img src="/logo.svg" alt="Jobix Logo" className="h-10 w-auto" />
                </div>
              </SidebarHeader>

              <SidebarContent className="px-2 py-4">
                <SidebarMenu>
                  {Object.entries(groupedItems).map(([category, items]) => (
                    <SidebarGroup key={category} className="mb-6">
                      <SidebarGroupLabel className="premium-group-label px-3 py-2 mb-3">
                        {categoryLabels[category]}
                      </SidebarGroupLabel>
                      <SidebarGroupContent>
                        {items.map((item, index) => {
                          const isActive = location.pathname === item.url.split('?')[0];
                          return (
                            <SidebarMenuItem key={index} className="px-0 mb-2">
                              <Link to={item.url} className="w-full">
                                <div className={`mx-2 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-50 shadow-sm border border-blue-100' : 'hover:bg-slate-50'}`}>
                                  <SidebarMenuButton className="w-full py-3 px-4 flex items-center gap-4 bg-transparent hover:bg-transparent">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${item.gradient} shadow-md transition-all duration-300 ${isActive ? 'scale-110 shadow-lg' : 'opacity-90 hover:opacity-100 hover:scale-105'}`}>
                                      <item.icon className="w-5 h-5 text-white" />
                                    </div>
                                    <span className={`premium-nav-item transition-all duration-200 ${
                                      isActive ? 'premium-nav-item active text-blue-800' : 'text-slate-700 hover:text-slate-900'
                                    }`}>
                                      {item.title}
                                    </span>
                                  </SidebarMenuButton>
                                </div>
                              </Link>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarGroupContent>
                    </SidebarGroup>
                  ))}
                </SidebarMenu>
              </SidebarContent>

              <SidebarFooter className="p-4 border-t border-slate-100">
                {user && (
                  <div className="premium-user-section p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 gradient-bg rounded-full flex items-center justify-center text-white font-bold shadow-md">
                        {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="user-name text-slate-900 truncate">
                          {user.full_name || 'Χρήστης'}
                        </p>
                        <p className="user-email truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleLogout}
                      variant="ghost"
                      className="logout-button w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 rounded-lg"
                      size="sm"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Αποσύνδεση
                    </Button>
                  </div>
                )}
                <div className="text-center mt-4">
                  <p className="text-xs text-slate-400 font-medium">© 2024 Jobix</p>
                </div>
              </SidebarFooter>
            </Sidebar>

            <main className="flex-1">
              <header className="p-4 border-b bg-white/50 backdrop-blur-sm lg:hidden pwa-safe-area pwa-standalone">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/logo.svg" alt="Jobix Logo" className="h-7 w-auto" />
                  </div>
                  <div className="flex items-center gap-2">
                    {user && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="text-red-600 hover:text-red-700"
                      >
                        <LogOut className="w-4 h-4" />
                      </Button>
                    )}
                    <SidebarTrigger>
                      <Button variant="ghost" size="icon">
                        <Menu />
                      </Button>
                    </SidebarTrigger>
                  </div>
                </div>
              </header>

              <div className="w-full pwa-safe-area">
                <EmailVerificationBanner />
                <TrialStatusBanner />
                {children}
              </div>

              <div className="block lg:hidden h-20" />
              <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg lg:hidden z-50 pwa-safe-area">
                <div className="flex justify-around items-center py-2 px-1">
                  {navigationItems.slice(0, 4).map((item) => {
                    const isActive = location.pathname === item.url.split('?')[0];
                    return (
                      <Link
                        key={item.title}
                        to={item.url}
                        className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 min-w-0 flex-1 ${
                          isActive
                            ? 'text-blue-700 bg-blue-50 shadow-sm'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <item.icon
                          size={22}
                          className={`mb-1 ${isActive ? 'text-blue-700' : 'text-slate-500'}`}
                        />
                        <span className={`text-xs leading-tight text-center font-medium ${
                          isActive ? 'text-blue-700 font-semibold' : 'text-slate-600'
                        }`}>
                          {item.title}
                        </span>
                      </Link>
                    );
                  })}
                  <SidebarTrigger>
                    <div className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-200 min-w-0 flex-1 text-slate-600 hover:text-slate-800 hover:bg-slate-50`}>
                      <ChevronRight size={22} className="mb-1 text-slate-500" />
                      <span className="text-xs leading-tight text-center font-medium text-slate-600">
                        Περισσότερα
                      </span>
                    </div>
                  </SidebarTrigger>
                </div>
              </div>
            </main>
          </div>
        </SidebarProvider>

        <PWAInstallPrompt />
      </div>
    </>
  );
}


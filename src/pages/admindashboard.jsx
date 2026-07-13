
import React, { useState, useEffect } from 'react';
import { Organization, User } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, HardHat, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [orgs, usrs] = await Promise.all([
          Organization.list('-created_date'),
          User.list()
        ]);
        setOrganizations(orgs);
        setUsers(usrs);
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getOwner = (orgId) => {
    return users.find(u => u.organization_id === orgId && u.role === 'owner');
  };

  const getMemberCount = (orgId) => {
    return users.filter(u => u.organization_id === orgId).length;
  };

  const stats = {
    totalOrgs: organizations.length,
    totalUsers: users.length,
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
        <p className="text-slate-600 mb-8">Επισκόπηση της πλατφόρμας Jobix.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Σύνολο Οργανισμών</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalOrgs}</div>
                    <p className="text-xs text-muted-foreground">Εγγεγραμμένοι μάστορες/εταιρείες</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Σύνολο Χρηστών</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">Συμπεριλαμβάνονται ιδιοκτήτες & μέλη</p>
                </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Εγγεγραμμένοι Οργανισμοί</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Όνομα Εταιρείας</TableHead>
                    <TableHead>Ιδιοκτήτης</TableHead>
                    <TableHead className="text-center">Μέλη</TableHead>
                    <TableHead className="text-right">Ημ/νία Εγγραφής</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => {
                    const owner = getOwner(org.id);
                    return (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{owner?.full_name || '-'}</span>
                            <span className="text-xs text-muted-foreground">{owner?.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{getMemberCount(org.id)}</TableCell>
                        <TableCell className="text-right">
                          {format(new Date(org.created_date), 'dd MMM yyyy', { locale: el })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

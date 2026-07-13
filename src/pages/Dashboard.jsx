
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FolderKanban,
  FileText,
  CreditCard,
  TrendingUp,
  Plus,
  ArrowRight,
  Building2,
  Users,
  Calendar,
  AlertCircle,
  Banknote // Added for expenses
} from "lucide-react";
import { differenceInDays, addDays } from 'date-fns';
import { Project, Proposal, Payment, Client, Organization, Expense } from "@/api/entities"; // Added Expense
import OrganizationGuard from "../components/OrganizationGuard";
import { User } from "@/api/entities";

import StatsCard from "../components/dashboard/StatsCard";
import RecentProjects from "../components/dashboard/RecentProjects";
import PendingPayments from "../components/dashboard/PendingPayments";
import QuickActions from "../components/dashboard/QuickActions";
import ProjectsChart from "../components/dashboard/ProjectsChart";
import MonthlyRevenue from "../components/dashboard/MonthlyRevenue"; 

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeProjects: 0,
    pendingProposals: 0,
    outstandingAmount: 0,
    totalClients: 0,
    totalExpenses: 0 // Added for expenses
  });
  const [allProjects, setAllProjects] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [allPayments, setAllPayments] = useState([]); // Added for monthly revenue
  const [allExpenses, setAllExpenses] = useState([]); // Added for expenses chart
  const [isLoading, setIsLoading] = useState(true);
  const [isTrialActive, setIsTrialActive] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      if (!currentUser || !currentUser.organization_id) {
          setIsLoading(false);
          // Optionally, display a message to the user that organization data is missing
          console.warn("User or organization ID not found. Cannot load dashboard data.");
          return;
      }
      const orgId = currentUser.organization_id;

      // Check trial status
      const org = await Organization.get(orgId);
      if (org && org.subscription_status === 'trialing' && org.trial_started_at) {
        const trialStartDate = new Date(org.trial_started_at);
        const trialEndDate = addDays(trialStartDate, 30);
        const daysLeft = differenceInDays(trialEndDate, new Date());
        setIsTrialActive(daysLeft > 0);
      } else {
        setIsTrialActive(true); // Assume active if not in trial or status is active
      }

      const [projects, proposals, payments, clients, expenses] = await Promise.all([ // Added expenses
        Project.filter({ organization_id: orgId }, '-created_date'),
        Proposal.filter({ organization_id: orgId }, '-created_date'),
        Payment.filter({ organization_id: orgId }, '-created_date'),
        Client.filter({ organization_id: orgId }, '-created_date'),
        Expense.filter({ organization_id: orgId }, '-created_date') // Fetch expenses
      ]);

      // Calculate stats
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const pendingProposals = proposals.filter(p => p.status === 'sent').length;
      const outstandingAmount = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0); // Calculate total expenses


      setStats({
        activeProjects,
        pendingProposals,
        outstandingAmount,
        totalClients: clients.length,
        totalExpenses // Set total expenses
      });

      setAllProjects(projects);
      setRecentProjects(projects.slice(0, 5));
      setPendingPayments(payments.filter(p => p.status === 'pending').slice(0, 6));
      setAllPayments(payments); // For the monthly revenue chart
      setAllExpenses(expenses); // Set all expenses for the chart
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Optionally, set stats to default values or show an error state
      setStats({
        activeProjects: 0,
        pendingProposals: 0,
        outstandingAmount: 0,
        totalClients: 0,
        totalExpenses: 0
      });
      setAllProjects([]);
      setRecentProjects([]);
      setPendingPayments([]);
      setAllPayments([]); // Reset all payments on error
      setAllExpenses([]); // Reset all expenses on error
    }
    setIsLoading(false);
  };

  return (
    <OrganizationGuard>
      <div className="p-4 md:p-8 space-y-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
                Καλησπέρα! 👋
              </h1>
              <p className="text-sm md:text-base lg:text-lg text-slate-600">Εδώ είναι η επισκόπηση των έργων σας</p>
            </div>
            <Link to={createPageUrl("ProposalNew")}>
              <Button
                disabled={!isTrialActive}
                className="gradient-bg text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 md:w-5 h-4 md:h-5 mr-2" />
                <span className="text-sm md:text-base">Νέα Προσφορά</span>
              </Button>
            </Link>
          </div>

          {/* Stats Cards - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            <StatsCard
              title="Ενεργά Έργα"
              value={stats.activeProjects}
              icon={FolderKanban}
              color="blue"
              isLoading={isLoading}
            />
            <StatsCard
              title="Προσφορές σε Εκκρεμότητα"
              value={stats.pendingProposals}
              icon={FileText}
              color="purple"
              isLoading={isLoading}
            />
            <StatsCard
              title="Συνολικά Έξοδα"
              value={`€${stats.totalExpenses.toLocaleString('el-GR')}`}
              icon={Banknote}
              color="red"
              isLoading={isLoading}
            />
            <StatsCard
              title="Υπόλοιπα προς Είσπραξη"
              value={`€${stats.outstandingAmount.toLocaleString('el-GR')}`}
              icon={CreditCard}
              color="green"
              isLoading={isLoading}
            />
          </div>

          {/* Quick Actions */}
          <QuickActions />

          {/* Main Content Grid - Enhanced */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ProjectsChart projects={allProjects} isLoading={isLoading} />
              <MonthlyRevenue payments={allPayments} expenses={allExpenses} isLoading={isLoading} /> {/* Added expenses prop */}
              <RecentProjects projects={recentProjects} isLoading={isLoading} />
            </div>
            <div>
              <PendingPayments payments={pendingPayments} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>
    </OrganizationGuard>
  );
}

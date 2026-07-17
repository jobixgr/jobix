// Κεντρικό routing της εφαρμογής.

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';

// ---- EAGER: όσα πρέπει να φορτώνουν ΑΜΕΣΩΣ ----
// Η landing και το login είναι η πρώτη επαφή — δεν πρέπει να δείχνουν spinner.
import Home from './Home';
import Login from './Login';

// ---- LAZY: όλα τα υπόλοιπα ----
// ΓΙΑΤΙ: πριν φορτώνονταν ΚΑΙ ΟΙ 36 σελίδες μαζί (~1.35MB), ακόμα κι αν ο
// χρήστης πήγαινε μόνο στο login. Τώρα κατεβαίνει μόνο ό,τι χρειάζεται.
// Τα βαριά γραφήματα (recharts) μπαίνουν μόνο με το Dashboard.
const Privacy = lazy(() => import('./privacy'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const ResetPassword = lazy(() => import('./ResetPassword'));
const VerifyEmail = lazy(() => import('./VerifyEmail'));

const Dashboard = lazy(() => import('./Dashboard'));
const Onboarding = lazy(() => import('./Onboarding'));
const Agenda = lazy(() => import('./Agenda'));
const Proposals = lazy(() => import('./Proposals'));
const ProposalNew = lazy(() => import('./ProposalNew'));
const ProposalEdit = lazy(() => import('./ProposalEdit'));
const ProposalDetail = lazy(() => import('./ProposalDetail'));
const Projects = lazy(() => import('./Projects'));
const ProjectNew = lazy(() => import('./ProjectNew'));
const ProjectEdit = lazy(() => import('./ProjectEdit'));
const ProjectView = lazy(() => import('./ProjectView'));
const Clients = lazy(() => import('./Clients'));
const ClientNew = lazy(() => import('./ClientNew'));
const ClientEdit = lazy(() => import('./ClientEdit'));
const ClientView = lazy(() => import('./ClientView'));
const Invoices = lazy(() => import('./Invoices'));
const InvoiceNew = lazy(() => import('./InvoiceNew'));
const InvoiceHistory = lazy(() => import('./InvoiceHistory'));
const InvoiceView = lazy(() => import('./InvoiceView'));
const Payments = lazy(() => import('./Payments'));
const Templates = lazy(() => import('./Templates'));
const Settings = lazy(() => import('./Settings'));
const Subscription = lazy(() => import('./Subscription'));
const AdminDashboard = lazy(() => import('./admindashboard'));
const Care = lazy(() => import('./Care'));

// Δημόσιες σελίδες (χωρίς Layout / χωρίς login)
const ClientPortal = lazy(() => import('./ClientPortal'));
const PublicProjectView = lazy(() => import('./PublicProjectView'));
const PublicCareOffer = lazy(() => import('./PublicCareOffer'));
const ProposalPDF = lazy(() => import('./ProposalPDF'));

// Εμφανίζεται όσο κατεβαίνει το κομμάτι κώδικα της σελίδας (συνήθως ms).
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Βοηθητικό: τυλίγει προστατευμένες σελίδες στο Layout με το σωστό currentPageName.
const wrap = (name, Component) => (
  <Layout currentPageName={name}>
    <Component />
  </Layout>
);

export default function Pages() {
  return (
    <BrowserRouter>
      {/* Suspense: απαραίτητο για τα lazy-loaded routes. */}
      <Suspense fallback={<PageLoader />}>
        <Routes>
        {/* Δημόσιες */}
        <Route path="/" element={<Home />} />
        <Route path="/index" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/clientportal" element={<ClientPortal />} />
        <Route path="/publicprojectview" element={<PublicProjectView />} />
        <Route path="/careoffer" element={<PublicCareOffer />} />
        <Route path="/proposalpdf" element={<ProposalPDF />} />

        {/* Προστατευμένες (μέσα στο Layout) */}
        <Route path="/dashboard" element={wrap('Dashboard', Dashboard)} />
        <Route path="/onboarding" element={wrap('Onboarding', Onboarding)} />
        <Route path="/agenda" element={wrap('Agenda', Agenda)} />
        <Route path="/care" element={wrap('Care', Care)} />
        <Route path="/proposals" element={wrap('Proposals', Proposals)} />
        <Route path="/proposalnew" element={wrap('ProposalNew', ProposalNew)} />
        <Route path="/proposaledit" element={wrap('ProposalEdit', ProposalEdit)} />
        <Route path="/proposaldetail" element={wrap('ProposalDetail', ProposalDetail)} />
        <Route path="/projects" element={wrap('Projects', Projects)} />
        <Route path="/projectnew" element={wrap('ProjectNew', ProjectNew)} />
        <Route path="/projectedit" element={wrap('ProjectEdit', ProjectEdit)} />
        <Route path="/projectview" element={wrap('ProjectView', ProjectView)} />
        <Route path="/clients" element={wrap('Clients', Clients)} />
        <Route path="/clientnew" element={wrap('ClientNew', ClientNew)} />
        <Route path="/clientedit" element={wrap('ClientEdit', ClientEdit)} />
        <Route path="/clientview" element={wrap('ClientView', ClientView)} />
        <Route path="/invoices" element={wrap('Invoices', Invoices)} />
        <Route path="/invoicenew" element={wrap('InvoiceNew', InvoiceNew)} />
        <Route path="/invoicehistory" element={wrap('InvoiceHistory', InvoiceHistory)} />
        <Route path="/invoiceview" element={wrap('InvoiceView', InvoiceView)} />
        <Route path="/payments" element={wrap('Payments', Payments)} />
        <Route path="/templates" element={wrap('Templates', Templates)} />
        <Route path="/settings" element={wrap('Settings', Settings)} />
        <Route path="/subscription" element={wrap('Subscription', Subscription)} />
        <Route path="/admindashboard" element={wrap('admindashboard', AdminDashboard)} />

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

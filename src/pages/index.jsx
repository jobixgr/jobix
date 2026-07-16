// Κεντρικό routing της εφαρμογής (πριν το παρήγαγε αυτόματα το Base44 —
// τώρα είναι δικό μας και πλήρως επεξεργάσιμο).

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout';

import Home from './Home';
import Privacy from './privacy';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import VerifyEmail from './VerifyEmail';

import Dashboard from './Dashboard';
import Onboarding from './Onboarding';
import Agenda from './Agenda';
import Proposals from './Proposals';
import ProposalNew from './ProposalNew';
import ProposalEdit from './ProposalEdit';
import ProposalDetail from './ProposalDetail';
import Projects from './Projects';
import ProjectNew from './ProjectNew';
import ProjectEdit from './ProjectEdit';
import ProjectView from './ProjectView';
import Clients from './Clients';
import ClientNew from './ClientNew';
import ClientEdit from './ClientEdit';
import ClientView from './ClientView';
import Invoices from './Invoices';
import InvoiceNew from './InvoiceNew';
import InvoiceHistory from './InvoiceHistory';
import InvoiceView from './InvoiceView';
import Payments from './Payments';
import Templates from './Templates';
import Settings from './Settings';
import Subscription from './Subscription';
import AdminDashboard from './admindashboard';

// Δημόσιες σελίδες (χωρίς Layout / χωρίς login)
import ClientPortal from './ClientPortal';
import PublicProjectView from './PublicProjectView';
import Care from './Care';
import ProposalPDF from './ProposalPDF';

// Βοηθητικό: τυλίγει προστατευμένες σελίδες στο Layout με το σωστό currentPageName.
const wrap = (name, Component) => (
  <Layout currentPageName={name}>
    <Component />
  </Layout>
);

export default function Pages() {
  return (
    <BrowserRouter>
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
        <Route path="/care" element={<Care />} />
        <Route path="/proposalpdf" element={<ProposalPDF />} />

        {/* Προστατευμένες (μέσα στο Layout) */}
        <Route path="/dashboard" element={wrap('Dashboard', Dashboard)} />
        <Route path="/onboarding" element={wrap('Onboarding', Onboarding)} />
        <Route path="/agenda" element={wrap('Agenda', Agenda)} />
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
    </BrowserRouter>
  );
}

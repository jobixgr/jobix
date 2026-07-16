// Functions API — πρώην Base44 backend functions, τώρα endpoints του δικού μας server.

import { apiFetch } from './http';

export const sendProposalEmail = ({ proposalId }) =>
  apiFetch('/api/functions/sendProposalEmail', {
    method: 'POST',
    body: { proposalId, origin: window.location.origin },
  });

export const sendInvoiceEmail = ({ invoiceId }) =>
  apiFetch('/api/functions/sendInvoiceEmail', { method: 'POST', body: { invoiceId } });

export const subscribeToPush = (payload) =>
  apiFetch('/api/functions/subscribeToPush', { method: 'POST', body: payload });

export const sendPushNotifications = (payload) =>
  apiFetch('/api/functions/sendPushNotifications', { method: 'POST', body: payload });

// Δημόσια (χωρίς login) — χρησιμοποιούνται από portal / δημόσιες σελίδες.
export const portalLogin = (token) =>
  apiFetch('/api/public/portal-login', { method: 'POST', body: { token } });

// ΑΣΦΑΛΕΙΑ: δέχεται token, όχι project id (το id δεν εκτίθεται πλέον δημόσια).
export const publicProject = (token) =>
  apiFetch('/api/public/project', { method: 'POST', body: { token } });

// Για τον ιδιοκτήτη: παίρνει τον δημόσιο σύνδεσμο του έργου (με token).
export const getProjectShareLink = ({ projectId }) =>
  apiFetch('/api/functions/getProjectShareLink', { method: 'POST', body: { projectId } });

export const viewPublicProposal = (token) =>
  apiFetch('/api/public/proposal', { method: 'POST', body: { token } });

export const handleProposalResponse = (token, response) =>
  apiFetch('/api/public/proposal-response', { method: 'POST', body: { token, response } });

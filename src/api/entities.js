// Entities API — συμβατό interface με το παλιό Base44 SDK
// (filter/list/get/create/update/delete/bulkCreate), αλλά προς το δικό μας backend.

import { apiFetch, setToken, clearToken } from './http';

function makeEntity(name) {
  return {
    list: (sort, limit) =>
      apiFetch(`/api/entities/${name}/query`, { method: 'POST', body: { sort, limit } }),
    filter: (where, sort, limit) =>
      apiFetch(`/api/entities/${name}/query`, { method: 'POST', body: { where, sort, limit } }),
    get: (id) => apiFetch(`/api/entities/${name}/${encodeURIComponent(id)}`),
    create: (data) => apiFetch(`/api/entities/${name}`, { method: 'POST', body: data }),
    bulkCreate: (items) =>
      apiFetch(`/api/entities/${name}/bulk`, { method: 'POST', body: { items } }),
    update: (id, data) =>
      apiFetch(`/api/entities/${name}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data }),
    delete: (id) =>
      apiFetch(`/api/entities/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export const Organization = makeEntity('Organization');
export const Client = makeEntity('Client');
export const Proposal = makeEntity('Proposal');
export const ProposalItem = makeEntity('ProposalItem');
export const Project = makeEntity('Project');
export const ProjectItem = makeEntity('ProjectItem');
export const Task = makeEntity('Task');
export const Payment = makeEntity('Payment');
export const Invoice = makeEntity('Invoice');
export const InvoiceItem = makeEntity('InvoiceItem');
export const File = makeEntity('File');
export const ItemTemplate = makeEntity('ItemTemplate');
export const TemplateGroup = makeEntity('TemplateGroup');
export const ProposalLink = makeEntity('ProposalLink');
export const Appointment = makeEntity('Appointment');
export const Expense = makeEntity('Expense');
export const ClientAccess = makeEntity('ClientAccess');

// Auth — συμβατό με τις κλήσεις που χρησιμοποιεί η εφαρμογή.
export const User = {
  me: () => apiFetch('/api/auth/me'),

  login: async (email, password) => {
    const { token, user } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(token);
    return user;
  },

  loginWithGoogle: async (credential) => {
    const { token, user } = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: { credential },
    });
    setToken(token);
    return user;
  },

  register: async (email, password, full_name) => {
    const { token, user } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { email, password, full_name },
    });
    setToken(token);
    return user;
  },

  logout: async () => {
    clearToken();
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* noop */ }
  },

  updateMyUserData: (data) => apiFetch('/api/auth/me', { method: 'PATCH', body: data }),

  list: () => apiFetch('/api/auth/users'),

  // Παλιά κλήση του Base44: τώρα απλώς οδηγεί στη δική μας σελίδα σύνδεσης.
  loginWithRedirect: async (nextUrl) => {
    window.location.href = `/login?next=${encodeURIComponent(nextUrl || '/dashboard')}`;
  },
};

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
// ---- Cache για το User.me() ----
// ΠΡΟΒΛΗΜΑ: πολλά components (Layout, Dashboard, banners, notifications) καλούσαν
// ταυτόχρονα το /api/auth/me → 4-5 ίδια requests σε κάθε φόρτωση σελίδας → αργό.
// ΛΥΣΗ: (α) αν υπάρχει ήδη request σε εξέλιξη, όλοι περιμένουν το ΙΔΙΟ (dedup),
//       (β) μικρό cache 30 δευτ. ώστε οι αλλαγές σελίδας να μην ξανακαλούν.
let _meCache = null;
let _meCacheAt = 0;
let _meInFlight = null;
const ME_TTL = 30_000;

export function clearUserCache() {
  _meCache = null;
  _meCacheAt = 0;
  _meInFlight = null;
}

function fetchMe(force = false) {
  const now = Date.now();
  if (!force && _meCache && now - _meCacheAt < ME_TTL) {
    return Promise.resolve(_meCache);
  }
  if (!force && _meInFlight) return _meInFlight;

  _meInFlight = apiFetch('/api/auth/me')
    .then((u) => {
      _meCache = u;
      _meCacheAt = Date.now();
      _meInFlight = null;
      return u;
    })
    .catch((e) => {
      _meInFlight = null;
      _meCache = null;
      throw e;
    });
  return _meInFlight;
}

export const User = {
  me: () => fetchMe(),
  refresh: () => fetchMe(true),

  login: async (email, password) => {
    clearUserCache();
    const { token, user } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(token);
    _meCache = user; _meCacheAt = Date.now();  // πρόσφατο, αποφεύγει επιπλέον κλήση
    return user;
  },

  loginWithGoogle: async (credential) => {
    clearUserCache();
    const { token, user } = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: { credential },
    });
    setToken(token);
    _meCache = user; _meCacheAt = Date.now();
    return user;
  },

  forgotPassword: (email) => apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: { email, origin: window.location.origin },
  }),

  resetPassword: (token, password) => apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  }),

  changePassword: (currentPassword, newPassword) => apiFetch('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  }),

  changeEmail: async (newEmail, currentPassword) => {
    const res = await apiFetch('/api/auth/change-email', {
      method: 'POST',
      body: { newEmail, currentPassword },
    });
    clearUserCache();  // το email άλλαξε
    return res;
  },

  verifyEmail: async (token) => {
    const res = await apiFetch('/api/auth/verify-email', { method: 'POST', body: { token } });
    clearUserCache();  // το email_verified άλλαξε
    return res;
  },

  resendVerification: () => apiFetch('/api/auth/resend-verification', {
    method: 'POST',
    body: { origin: window.location.origin },
  }),

  register: async (email, password, full_name) => {
    clearUserCache();
    const { token, user } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { email, password, full_name, origin: window.location.origin },
    });
    setToken(token);
    _meCache = user; _meCacheAt = Date.now();
    return user;
  },

  logout: async () => {
    clearToken();
    clearUserCache();
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* noop */ }
  },

  updateMyUserData: async (data) => {
    const updated = await apiFetch('/api/auth/me', { method: 'PATCH', body: data });
    _meCache = updated; _meCacheAt = Date.now();  // κράτα το cache συγχρονισμένο
    return updated;
  },

  list: () => apiFetch('/api/auth/users'),

  // Παλιά κλήση του Base44: τώρα απλώς οδηγεί στη δική μας σελίδα σύνδεσης.
  loginWithRedirect: async (nextUrl) => {
    window.location.href = `/login?next=${encodeURIComponent(nextUrl || '/dashboard')}`;
  },
};

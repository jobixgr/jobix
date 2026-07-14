// Ενιαίο API entry point για το Jobix.
// Ένα μόνο serverless function που δρομολογεί ΟΛΑ τα /api/* εσωτερικά,
// ώστε να αποφύγουμε προβλήματα με ονόματα αρχείων [...path].js.
import {
  ENTITY_MAP, supa, toClient, toData, signToken, hashPassword, verifyPassword,
  getUserFromReq, publicUser, isAdmin, send, readJson, applyCors, now,
  enforceRateLimit, clientIp, sendEmail, invokeLLM,
} from './_lib/core.js';
import crypto from 'node:crypto';

const first = (arr) => (arr && arr[0] ? arr[0] : null);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = process.env.SUPABASE_BUCKET || 'jobix-uploads';

async function ensureProposalLink(proposalId, orgId, createdBy) {
  const existing = (await supa.select('proposal_links', { 'data->>proposal_id': `eq.${proposalId}` })).map(toClient);
  if (existing.length) return existing[0];
  const row = await supa.insert('proposal_links', {
    organization_id: orgId,
    created_by: createdBy || 'system',
    data: { proposal_id: proposalId, token: crypto.randomUUID() },
  });
  return toClient(row);
}

function owns(user, row) {
  if (isAdmin(user)) return true;
  return row && row.organization_id === user.organization_id;
}

async function uploadToStorage({ name, type, data }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const err = new Error('Λείπουν οι μεταβλητές Supabase.'); err.status = 501; throw err;
  }
  const buf = Buffer.from(data, 'base64');
  if (buf.length > 20 * 1024 * 1024) { const err = new Error('Το αρχείο ξεπερνά τα 20MB.'); err.status = 413; throw err; }
  const ext = (name.match(/\.[a-zA-Z0-9]{1,10}$/) || [''])[0];
  const objectPath = `${new Date().getFullYear()}/${crypto.randomUUID()}${ext}`;
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'true' },
    body: buf,
  });
  if (!resp.ok) { const d = await resp.text().catch(()=> ''); console.error('Storage error:', resp.status, d); const err = new Error('Αποτυχία αποθήκευσης αρχείου.'); err.status = 502; throw err; }
  return { file_url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`, name, type, size: buf.length };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Το path έρχεται από το rewrite ως ?path=auth/login (string με slashes),
  // ή από το url pathname ως fallback.
  let raw = req.query && req.query.path;
  if (Array.isArray(raw)) raw = raw.join('/');
  if (!raw) {
    const url = new URL(req.url, 'http://x');
    raw = url.pathname.replace(/^\/api\/?/, '');
  }
  const segments = String(raw).split('/').filter(Boolean);
  const group = segments[0];        // auth | entities | public | functions | integrations
  const rest = segments.slice(1);   // τα υπόλοιπα

  try {
    // ============ AUTH ============
    if (group === 'auth') {
      const action = rest[0];

    // ---------- REGISTER ----------
    if (action === 'register' && req.method === 'POST') {
      // Προστασία: max 5 εγγραφές ανά IP / ώρα
      if (await enforceRateLimit(req, res, { name: 'register', identifier: clientIp(req), limit: 5, windowSec: 3600 })) return;
      const { email, password, full_name } = await readJson(req);
      if (!email || !password || password.length < 8) {
        return send(res, 400, { error: 'Απαιτείται email και κωδικός τουλάχιστον 8 χαρακτήρων.' });
      }
      const normalized = String(email).trim().toLowerCase();
      const existing = await supa.select('app_users', { email: `eq.${normalized}` });
      if (existing && existing.length) {
        return send(res, 409, { error: 'Υπάρχει ήδη λογαριασμός με αυτό το email.' });
      }
      const user = await supa.insert('app_users', {
        email: normalized,
        password: hashPassword(password),
        full_name: full_name || '',
        role: 'user',
        organization_id: null,
      });
      const token = signToken({ sub: user.id });
      return send(res, 200, { token, user: publicUser(user) });
    }

    // ---------- LOGIN ----------
    // ---------- GOOGLE OAUTH ----------
    if (action === 'google' && req.method === 'POST') {
      if (await enforceRateLimit(req, res, { name: 'google-login', identifier: clientIp(req), limit: 20, windowSec: 900 })) return;
      const { credential } = await readJson(req);
      if (!credential) return send(res, 400, { error: 'Λείπει το Google credential.' });

      // Επαλήθευση του Google ID token μέσω του tokeninfo endpoint της Google.
      const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!gRes.ok) return send(res, 401, { error: 'Μη έγκυρη σύνδεση Google.' });
      const gData = await gRes.json();

      // Έλεγχος ότι το token προορίζεται για τη δική μας εφαρμογή.
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (expectedClientId && gData.aud !== expectedClientId) {
        return send(res, 401, { error: 'Το Google token δεν προορίζεται για αυτή την εφαρμογή.' });
      }
      if (gData.email_verified !== 'true' && gData.email_verified !== true) {
        return send(res, 401, { error: 'Το Google email δεν είναι επιβεβαιωμένο.' });
      }

      const email = String(gData.email || '').trim().toLowerCase();
      if (!email) return send(res, 401, { error: 'Δεν βρέθηκε email στη σύνδεση Google.' });

      // Βρες υπάρχοντα χρήστη ή δημιούργησε νέο (χωρίς κωδικό — μόνο Google).
      let user = first(await supa.select('app_users', { email: `eq.${email}` }));
      if (!user) {
        user = await supa.insert('app_users', {
          email,
          password: 'google-oauth-no-password',  // δεν χρησιμοποιείται ποτέ για login
          full_name: gData.name || '',
          role: 'user',
          organization_id: null,
        });
      }
      const token = signToken({ sub: user.id });
      return send(res, 200, { token, user: publicUser(user) });
    }

    if (action === 'login' && req.method === 'POST') {
      const { email, password } = await readJson(req);
      const normalized = String(email || '').trim().toLowerCase();
      // Προστασία brute-force: max 10 προσπάθειες ανά IP / 15 λεπτά
      // ΚΑΙ max 5 ανά email / 15 λεπτά (ώστε να μην κλειδώνει άλλους χρήστες πίσω από το ίδιο NAT)
      if (await enforceRateLimit(req, res, { name: 'login-ip', identifier: clientIp(req), limit: 10, windowSec: 900 })) return;
      if (normalized && await enforceRateLimit(req, res, { name: 'login-email', identifier: normalized, limit: 5, windowSec: 900 })) return;
      const rows = await supa.select('app_users', { email: `eq.${normalized}` });
      const user = rows && rows[0];
      if (!user || !verifyPassword(password || '', user.password)) {
        return send(res, 401, { error: 'Λάθος email ή κωδικός.' });
      }
      const token = signToken({ sub: user.id });
      return send(res, 200, { token, user: publicUser(user) });
    }

    // ---------- LOGOUT ----------
    if (action === 'logout' && req.method === 'POST') {
      return send(res, 200, { ok: true }); // stateless JWT
    }

    // ---------- ME ----------
    if (action === 'me') {
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });

      if (req.method === 'GET') return send(res, 200, publicUser(user));

      if (req.method === 'PATCH') {
        const body = await readJson(req);
        const patch = {};
        for (const k of ['full_name', 'phone', 'position']) {
          if (k in body) patch[k] = body[k];
        }
        if ('organization_id' in body && body.organization_id !== user.organization_id) {
          const orgs = await supa.select('organizations', { id: `eq.${body.organization_id}` });
          const org = orgs && orgs[0];
          if (!org) return send(res, 400, { error: 'Ο οργανισμός δεν βρέθηκε.' });
          if (!isAdmin(user) && org.owner_user_id !== user.id) {
            return send(res, 403, { error: 'Δεν επιτρέπεται η σύνδεση σε αυτόν τον οργανισμό.' });
          }
          patch.organization_id = body.organization_id;
        }
        patch.updated_date = now();
        const updated = await supa.update('app_users', user.id, patch);
        return send(res, 200, publicUser(updated));
      }
    }

    // ---------- USERS (admin) ----------
    if (action === 'users' && req.method === 'GET') {
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
      if (!isAdmin(user)) return send(res, 403, { error: 'Μόνο για διαχειριστές.' });
      const all = await supa.select('app_users', {});
      return send(res, 200, all.map(publicUser));
    }
    }
    // ============ ENTITIES ============
    if (group === 'entities') {
      const name = rest[0];
      const tail = rest[1];

      const table = ENTITY_MAP[name];
      if (!table) return send(res, 404, { error: `Άγνωστο entity: ${name}` });

      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });

      const admin = isAdmin(user);

      const orgFilter = () => {
        if (admin) return {};
        if (table === 'organizations') {
          return { or: `(id.eq.${user.organization_id || '00000000-0000-0000-0000-000000000000'},owner_user_id.eq.${user.id})` };
        }
        return { organization_id: `eq.${user.organization_id || '00000000-0000-0000-0000-000000000000'}` };
      };

      const canWrite = (row) => {
        if (admin) return true;
        if (table === 'organizations') return row.id === user.organization_id || row.owner_user_id === user.id;
        return row.organization_id && row.organization_id === user.organization_id;
      };

      const stampCreate = (input) => {
        const data = toData(input);
        const base = { data, created_by: user.email, created_date: now(), updated_date: now() };
        if (table === 'organizations') {
          base.owner_user_id = user.id;
        } else {
          base.organization_id = user.organization_id;
        }
        return base;
      };

    // ---------- QUERY ----------
    if (req.method === 'POST' && tail === 'query') {
      const body = await readJson(req);
      const filters = { ...orgFilter() };
      // where: ισότητες πάνω σε δυναμικά πεδία (data->>key) ή σταθερά
      if (body.where) {
        for (const [k, v] of Object.entries(body.where)) {
          if (['id', 'organization_id', 'created_by'].includes(k)) {
            filters[k] = `eq.${v}`;
          } else {
            filters[`data->>${k}`] = `eq.${v}`;
          }
        }
      }
      let order;
      if (body.sort) {
        const desc = body.sort.startsWith('-');
        const field = desc ? body.sort.slice(1) : body.sort;
        const col = ['created_date', 'updated_date'].includes(field) ? field : `data->>${field}`;
        order = `${col}.${desc ? 'desc' : 'asc'}`;
      }
      const rows = await supa.select(table, filters, { order, limit: body.limit });
      return send(res, 200, rows.map(toClient));
    }

    // ---------- BULK CREATE ----------
    if (req.method === 'POST' && tail === 'bulk') {
      const body = await readJson(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const out = [];
      for (const item of items) {
        const row = await supa.insert(table, stampCreate(item));
        out.push(toClient(row));
      }
      return send(res, 200, out);
    }

    // ---------- CREATE ----------
    if (req.method === 'POST' && !tail) {
      if (table !== 'organizations' && !user.organization_id && !admin) {
        return send(res, 400, { error: 'Ο λογαριασμός δεν ανήκει σε οργανισμό ακόμα.' });
      }
      const body = await readJson(req);
      const row = await supa.insert(table, stampCreate(body));
      return send(res, 200, toClient(row));
    }

    // ---------- GET by id ----------
    if (req.method === 'GET' && tail) {
      const rows = await supa.select(table, { id: `eq.${tail}` });
      const row = rows && rows[0];
      if (!row || !canWrite(row)) return send(res, 404, { error: 'Δεν βρέθηκε.' });
      return send(res, 200, toClient(row));
    }

    // ---------- UPDATE ----------
    if (req.method === 'PATCH' && tail) {
      const rows = await supa.select(table, { id: `eq.${tail}` });
      const row = rows && rows[0];
      if (!row || !canWrite(row)) return send(res, 404, { error: 'Δεν βρέθηκε.' });
      const body = await readJson(req);
      // Προστασία: δεν αλλάζουν organization_id/ιδιοκτησία/ids μέσω update
      const merged = { ...(row.data || {}) };
      for (const [k, v] of Object.entries(body)) {
        if (['id', 'organization_id', 'owner_user_id', 'created_date', 'created_by'].includes(k)) continue;
        merged[k] = v;
      }
      const updated = await supa.update(table, tail, { data: merged, updated_date: now() });
      return send(res, 200, toClient(updated));
    }

    // ---------- DELETE ----------
    if (req.method === 'DELETE' && tail) {
      const rows = await supa.select(table, { id: `eq.${tail}` });
      const row = rows && rows[0];
      if (!row || !canWrite(row)) return send(res, 404, { error: 'Δεν βρέθηκε.' });
      await supa.remove(table, tail);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'Not found' });
  
    }
    // ============ PUBLIC ============
    if (group === 'public') {
      const action = rest[0];
      if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });
      const strict = action === 'portal-login' || action === 'proposal-response';
      if (await enforceRateLimit(req, res, { name: `public-${action}`, identifier: clientIp(req), limit: strict ? 20 : 60, windowSec: 60 })) return;
      const body = await readJson(req);

    // ---------- CLIENT PORTAL LOGIN ----------
    if (action === 'portal-login') {
      const token = String(body.token || '').trim();
      if (!token) return send(res, 400, { error: 'Λείπει ο κωδικός πρόσβασης.' });
      const access = toClient(first(await supa.select('client_access', { 'data->>access_token': `eq.${token}` })));
      if (!access) return send(res, 404, { error: 'Μη έγκυρος κωδικός πρόσβασης.' });
      if (access.is_active === false) return send(res, 403, { error: 'Η πρόσβαση έχει απενεργοποιηθεί.' });
      if (access.expires_at && new Date(access.expires_at) < new Date()) {
        return send(res, 403, { error: 'Η πρόσβαση έχει λήξει.' });
      }
      const client = toClient(first(await supa.select('clients', { id: `eq.${access.client_id}` })));
      if (!client) return send(res, 404, { error: 'Δεν βρέθηκαν στοιχεία πελάτη.' });

      const projects = (await supa.select('projects', { 'data->>client_id': `eq.${client.id}` })).map(toClient);
      const projectIds = new Set(projects.map((p) => p.id));
      const invoices = (await supa.select('invoices', { 'data->>client_id': `eq.${client.id}` })).map(toClient);
      const allFiles = (await supa.select('files', { organization_id: `eq.${client.organization_id}` })).map(toClient);
      const files = allFiles.filter((f) => projectIds.has(f.project_id));

      await supa.update('client_access', access.id, { data: { ...access, last_accessed: now() } });
      return send(res, 200, { client, projects, invoices, files });
    }

    // ---------- PUBLIC PROJECT ----------
    if (action === 'project') {
      const project = toClient(first(await supa.select('projects', { id: `eq.${body.id}` })));
      if (!project) return send(res, 404, { error: 'Το έργο δεν βρέθηκε.' });
      const org = toClient(first(await supa.select('organizations', { id: `eq.${project.organization_id}` })));
      const tasks = (await supa.select('tasks', { 'data->>project_id': `eq.${project.id}` })).map(toClient);
      const payments = (await supa.select('payments', { 'data->>project_id': `eq.${project.id}` })).map(toClient);
      const files = (await supa.select('files', { 'data->>project_id': `eq.${project.id}` })).map(toClient);
      return send(res, 200, {
        project, tasks, payments, files,
        organization: org ? { id: org.id, name: org.name, phone: org.phone, email: org.email, logo_url: org.logo_url } : null,
      });
    }

    // ---------- PUBLIC PROPOSAL (view) ----------
    if (action === 'proposal') {
      const link = toClient(first(await supa.select('proposal_links', { 'data->>token': `eq.${String(body.token || '')}` })));
      if (!link) return send(res, 404, { error: 'Ο σύνδεσμος δεν είναι έγκυρος.' });
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return send(res, 403, { error: 'Ο σύνδεσμος έχει λήξει.' });
      }
      const proposal = toClient(first(await supa.select('proposals', { id: `eq.${link.proposal_id}` })));
      if (!proposal) return send(res, 404, { error: 'Η προσφορά δεν βρέθηκε.' });
      const items = (await supa.select('proposal_items', { 'data->>proposal_id': `eq.${proposal.id}` })).map(toClient);
      const client = toClient(first(await supa.select('clients', { id: `eq.${proposal.client_id}` })));
      const org = toClient(first(await supa.select('organizations', { id: `eq.${proposal.organization_id}` })));
      return send(res, 200, {
        proposal, items,
        client: client ? { id: client.id, name: client.name } : null,
        organization: org ? { id: org.id, name: org.name, phone: org.phone, email: org.email, address: org.address, logo_url: org.logo_url } : null,
      });
    }

    // ---------- PROPOSAL RESPONSE (accept/reject + convert to project) ----------
    if (action === 'proposal-response') {
      const link = toClient(first(await supa.select('proposal_links', { 'data->>token': `eq.${String(body.token || '')}` })));
      if (!link) return send(res, 404, { error: 'Ο σύνδεσμος δεν είναι έγκυρος.' });
      const proposalRow = first(await supa.select('proposals', { id: `eq.${link.proposal_id}` }));
      const proposal = toClient(proposalRow);
      if (!proposal) return send(res, 404, { error: 'Η προσφορά δεν βρέθηκε.' });

      const response = body.response === 'accepted' ? 'accepted' : body.response === 'rejected' ? 'rejected' : null;
      if (!response) return send(res, 400, { error: 'Μη έγκυρη απάντηση.' });
      if (proposal.status === 'accepted' || proposal.status === 'rejected') {
        return send(res, 409, { error: 'Έχει ήδη δοθεί απάντηση σε αυτή την προσφορά.', status: proposal.status });
      }

      // ενημέρωση status προσφοράς
      const newData = { ...(proposalRow.data || {}), status: response, responded_at: now() };
      if (response === 'accepted') newData.accepted_at = now();
      await supa.update('proposals', proposal.id, { data: newData, updated_date: now() });

      // Μετατροπή σε έργο (μόνο σε accepted, μόνο αν δεν υπάρχει ήδη)
      if (response === 'accepted') {
        try {
          const orgId = proposal.organization_id;
          const today = new Date().toISOString().split('T')[0];
          const existing = (await supa.select('projects', { 'data->>proposal_id': `eq.${proposal.id}` })).map(toClient);
          if (existing.length === 0) {
            const projectRow = await supa.insert('projects', {
              organization_id: orgId,
              created_by: proposal.created_by || 'system',
              data: {
                client_id: proposal.client_id,
                proposal_id: proposal.id,
                title: proposal.title,
                description: proposal.description || 'Έργο βάσει προσφοράς',
                status: 'active',
                start_date: today,
                budget_total: proposal.total,
                notes: `Δημιουργήθηκε αυτόματα από αποδοχή προσφοράς #${proposal.number} από τον πελάτη`,
              },
            });
            const project = toClient(projectRow);

            // εργασίες
            const items = (await supa.select('proposal_items', { 'data->>proposal_id': `eq.${proposal.id}` })).map(toClient);
            for (const item of items) {
              await supa.insert('tasks', {
                organization_id: orgId,
                created_by: proposal.created_by || 'system',
                data: {
                  project_id: project.id,
                  title: item.description,
                  description: `${item.type === 'labor' ? '🔧 Εργασία' : '📦 Υλικό'} - Ποσότητα: ${item.quantity} ${item.unit || 'τεμ.'}, Τιμή: €${item.unit_price}`,
                  status: 'todo',
                  priority: 'medium',
                },
              });
            }

            // προκαταβολή
            if (proposal.has_advance && proposal.advance_amount > 0) {
              await supa.insert('payments', {
                organization_id: orgId,
                created_by: proposal.created_by || 'system',
                data: {
                  project_id: project.id,
                  client_id: proposal.client_id,
                  title: `Προκαταβολή για ${proposal.title}`,
                  amount: proposal.advance_amount,
                  currency: proposal.currency || 'EUR',
                  due_date: proposal.advance_received_at || today,
                  status: 'paid',
                  paid_at: proposal.advance_received_at ? new Date(proposal.advance_received_at).toISOString() : now(),
                  method: 'bank_transfer',
                  notes: `Προκαταβολή από προσφορά #${proposal.number}`,
                },
              });
            }

            // υπόλοιπο
            const remaining = (proposal.total || 0) - (proposal.advance_amount || 0);
            if (remaining > 0) {
              const due = new Date(); due.setDate(due.getDate() + 30);
              await supa.insert('payments', {
                organization_id: orgId,
                created_by: proposal.created_by || 'system',
                data: {
                  project_id: project.id,
                  client_id: proposal.client_id,
                  title: `Υπόλοιπο πληρωμή για ${proposal.title}`,
                  amount: remaining,
                  currency: proposal.currency || 'EUR',
                  due_date: due.toISOString().split('T')[0],
                  status: 'pending',
                  notes: `Υπόλοιπο πληρωμή από προσφορά #${proposal.number}`,
                },
              });
            }
          }
        } catch (e) {
          console.error('⚠️ Μετατροπή σε έργο απέτυχε (η αποδοχή καταγράφηκε):', e);
        }
      }

      return send(res, 200, { ok: true, status: response });
    }

    return send(res, 404, { error: 'Not found' });
  
    }
    // ============ FUNCTIONS ============
    if (group === 'functions') {
      const action = rest[0];
      if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
      const body = await readJson(req);

    if (action === 'sendProposalEmail') {
      const proposalRow = first(await supa.select('proposals', { id: `eq.${body.proposalId}` }));
      if (!proposalRow || !owns(user, proposalRow)) return send(res, 404, { error: 'Η προσφορά δεν βρέθηκε.' });
      const proposal = toClient(proposalRow);
      const client = toClient(first(await supa.select('clients', { id: `eq.${proposal.client_id}` })));
      if (!client?.email) return send(res, 400, { error: 'Ο πελάτης δεν έχει καταχωρημένο email.' });
      const org = toClient(first(await supa.select('organizations', { id: `eq.${proposal.organization_id}` })));
      const link = await ensureProposalLink(proposal.id, proposal.organization_id, proposal.created_by);
      const publicUrl = `${body.origin || ''}/proposalpdf?token=${link.token}`;

      const result = await sendEmail({
        to: client.email,
        replyTo: org?.email || undefined,
        subject: `Προσφορά #${proposal.number || ''} από ${org?.name || 'Jobix'}`,
        body: `Αγαπητέ/ή ${client.name || ''},\n\nΣας ευχαριστούμε για το ενδιαφέρον σας. Μπορείτε να δείτε την προσφορά μας και να την αποδεχτείτε ή να την απορρίψετε από τον παρακάτω σύνδεσμο:\n\n${publicUrl}\n\nΜε εκτίμηση,\n${org?.name || 'Jobix'}`,
      });
      return send(res, 200, { emailSent: result.sent === true, publicUrl });
    }

    if (action === 'sendInvoiceEmail') {
      const invoiceRow = first(await supa.select('invoices', { id: `eq.${body.invoiceId}` }));
      if (!invoiceRow || !owns(user, invoiceRow)) return send(res, 404, { error: 'Το παραστατικό δεν βρέθηκε.' });
      const invoice = toClient(invoiceRow);
      const to = invoice.client_details?.email;
      if (!to) return send(res, 400, { error: 'Ο πελάτης δεν έχει καταχωρημένο email.' });
      const org = toClient(first(await supa.select('organizations', { id: `eq.${invoice.organization_id}` })));
      const result = await sendEmail({
        to,
        replyTo: org?.email || undefined,
        subject: `Παραστατικό #${invoice.number || ''} από ${org?.name || 'Jobix'}`,
        body: `Αγαπητέ/ή ${invoice.client_details?.name || ''},\n\nΤο παραστατικό #${invoice.number || ''} από ${org?.name || 'Jobix'} έχει εκδοθεί.\n\nΜε εκτίμηση,\n${org?.name || 'Jobix'}`,
      });
      return send(res, 200, { emailSent: result.sent === true });
    }

    if (action === 'subscribeToPush' || action === 'sendPushNotifications') {
      return send(res, 200, { supported: false });
    }

    return send(res, 404, { error: 'Not found' });
  
    }
    // ============ INTEGRATIONS ============
    if (group === 'integrations') {
      const action = rest[0];
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });

    if (action === 'upload') {
      // Προστασία: max 30 uploads ανά χρήστη / ώρα
      if (await enforceRateLimit(req, res, { name: 'upload', identifier: user.id, limit: 30, windowSec: 3600 })) return;
      const { name = 'file', type = 'application/octet-stream', data } = await readJson(req);
      if (!data) return send(res, 400, { error: 'Λείπει το αρχείο.' });
      const result = await uploadToStorage({ name, type, data });
      return send(res, 200, result);
    }

    if (action === 'invoke-llm') {
      // Προστασία κόστους AI: max 20 κλήσεις ανά χρήστη / ώρα + 5 ανά λεπτό (burst)
      if (await enforceRateLimit(req, res, { name: 'ai-min', identifier: user.id, limit: 5, windowSec: 60 })) return;
      if (await enforceRateLimit(req, res, { name: 'ai-hour', identifier: user.id, limit: 20, windowSec: 3600 })) return;
      const body = await readJson(req);
      const result = await invokeLLM(body);
      return send(res, 200, result);
    }

    return send(res, 404, { error: 'Not found' });
  
    }

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('api error:', e);
    return send(res, e.status || 500, { error: e.message || 'Σφάλμα server.' });
  }
}

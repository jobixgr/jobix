/**
 * Jobix standalone backend — αντικαθιστά πλήρως το Base44.
 *
 * Χαρακτηριστικά:
 *  - Καμία εξωτερική εξάρτηση (καθαρή Node.js >= 18)
 *  - Αποθήκευση σε JSON αρχείο (server/data/db.json)
 *  - Authentication με JWT (HS256) + scrypt password hashing
 *  - ΑΣΦΑΛΕΙΑ MULTI-TENANCY: κάθε εγγραφή "σφραγίζεται" server-side με το
 *    organization_id του χρήστη και ΟΛΑ τα queries περιορίζονται σε αυτό.
 *    (Στο Base44 ο περιορισμός γινόταν από τον client — κενό ασφαλείας.)
 *  - Δημόσια endpoints με token για: Client Portal, δημόσια προβολή έργου,
 *    δημόσια προβολή/αποδοχή προσφοράς.
 *  - Uploads αρχείων (base64) + στατικό σερβίρισμα
 *  - Προαιρετικό AI (InvokeLLM) μέσω Anthropic API αν οριστεί ANTHROPIC_API_KEY
 *  - Email: χωρίς SMTP τα μηνύματα γράφονται στο server/outbox/ και επιστρέφεται
 *    ο δημόσιος σύνδεσμος ώστε να τον στείλει ο χρήστης όπως θέλει.
 *  - Σε production σερβίρει και το χτισμένο frontend από το /dist (SPA fallback).
 *
 * Εκκίνηση:  node server/index.js   (πόρτα: PORT ή 4000)
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Φόρτωση μεταβλητών από αρχείο .env (χωρίς εξωτερική βιβλιοθήκη).
// Ψάχνει στο /server/.env και στη ρίζα του project.
(function loadDotEnv() {
  for (const envPath of [path.join(__dirname, '.env'), path.join(__dirname, '..', '.env')]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
})();

const PORT = process.env.PORT || 4000;
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTBOX_DIR = path.join(__dirname, 'outbox');
const DIST_DIR = path.join(ROOT, 'dist');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, '.secret');

for (const dir of [DATA_DIR, UPLOADS_DIR, OUTBOX_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

/* ------------------------------------------------------------------ */
/*  Database (JSON file, ατομική εγγραφή)                              */
/* ------------------------------------------------------------------ */

const COLLECTIONS = [
  'users', 'organizations', 'clients', 'proposals', 'proposal_items',
  'projects', 'project_items', 'tasks', 'payments', 'invoices',
  'invoice_items', 'files', 'item_templates', 'template_groups',
  'proposal_links', 'appointments', 'expenses', 'client_access',
];

// Αντιστοίχιση ονομάτων entities του frontend -> συλλογές
const ENTITY_MAP = {
  Organization: 'organizations',
  Client: 'clients',
  Proposal: 'proposals',
  ProposalItem: 'proposal_items',
  Project: 'projects',
  ProjectItem: 'project_items',
  Task: 'tasks',
  Payment: 'payments',
  Invoice: 'invoices',
  InvoiceItem: 'invoice_items',
  File: 'files',
  ItemTemplate: 'item_templates',
  TemplateGroup: 'template_groups',
  ProposalLink: 'proposal_links',
  Appointment: 'appointments',
  Expense: 'expenses',
  ClientAccess: 'client_access',
};

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    const fresh = {};
    for (const c of COLLECTIONS) fresh[c] = [];
    return fresh;
  }
}

const db = loadDb();
for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];

let saveTimer = null;
function saveDb() {
  // Μικρό debounce ώστε τα bulk operations να γράφουν μία φορά
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

/* ------------------------------------------------------------------ */
/*  Auth helpers (JWT HS256 + scrypt)                                  */
/* ------------------------------------------------------------------ */

function getSecret() {
  try {
    return fs.readFileSync(SECRET_FILE, 'utf8');
  } catch {
    const s = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 });
    return s;
  }
}
const JWT_SECRET = process.env.JWT_SECRET || getSecret();

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (obj) => b64url(JSON.stringify(obj));

function signToken(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const data = `${head}.${b64urlJson(body)}`;
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

/* ------------------------------------------------------------------ */
/*  Generic record helpers                                             */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();

function newRecord(data) {
  return {
    id: crypto.randomUUID(),
    ...data,
    created_date: now(),
    updated_date: now(),
  };
}

function applySort(list, sort) {
  if (!sort) return list;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [...list].sort((a, b) => {
    const av = a[field], bv = b[field];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    const cmp = av > bv ? 1 : -1;
    return desc ? -cmp : cmp;
  });
}

function matches(record, where) {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => record[k] === v);
}

/* ------------------------------------------------------------------ */
/*  HTTP plumbing                                                      */
/* ------------------------------------------------------------------ */

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

function readBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return db.users.find((u) => u.id === payload.sub) || null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ------------------------------------------------------------------ */
/*  Entity access rules (server-side multi-tenancy)                    */
/* ------------------------------------------------------------------ */

function isAdmin(user) {
  return user && user.role === 'super_admin';
}

/** Επιστρέφει τις εγγραφές που δικαιούται να δει ο χρήστης. */
function scopedList(user, collection) {
  if (collection === 'organizations') {
    if (isAdmin(user)) return db.organizations;
    return db.organizations.filter(
      (o) => o.id === user.organization_id || o.owner_user_id === user.id
    );
  }
  if (isAdmin(user)) return db[collection];
  if (!user.organization_id) return [];
  return db[collection].filter((r) => r.organization_id === user.organization_id);
}

function canWrite(user, collection, record) {
  if (isAdmin(user)) return true;
  if (collection === 'organizations') {
    return record.id === user.organization_id || record.owner_user_id === user.id;
  }
  return record.organization_id && record.organization_id === user.organization_id;
}

function createEntityRecord(user, collection, data) {
  const record = newRecord(data);
  if (collection === 'organizations') {
    record.owner_user_id = user.id;
  } else {
    // ΚΡΙΣΙΜΟ: το organization_id ορίζεται ΠΑΝΤΑ server-side.
    record.organization_id = user.organization_id;
  }
  record.created_by = user.email;
  db[collection].push(record);
  saveDb();
  return record;
}

/* ------------------------------------------------------------------ */
/*  Email — πραγματική αποστολή μέσω Resend (με fallback σε outbox)     */
/* ------------------------------------------------------------------ */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Jobix <offers@jobix.gr>';

// Απλή μετατροπή απλού κειμένου σε ασφαλές, ευανάγνωστο HTML.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtml(body) {
  // Κάνει τα URLs κλικαρίσιμα και διατηρεί τις αλλαγές γραμμής.
  const withLinks = escapeHtml(body).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" style="color:#2563eb">$1</a>'
  );
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">${withLinks.replace(/\n/g, '<br>')}</div>`;
}

function writeOutbox(entry) {
  const file = path.join(OUTBOX_DIR, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...entry, queued_at: now() }, null, 2));
  return file;
}

/**
 * Στέλνει email. Επιστρέφει { sent: true } αν έφυγε μέσω Resend,
 * αλλιώς { sent: false, queued: true } (γράφτηκε στο outbox).
 */
async function sendEmail({ to, subject, body, replyTo }) {
  if (!to) return { sent: false, queued: false, error: 'no-recipient' };

  if (!RESEND_API_KEY) {
    writeOutbox({ to, subject, body });
    return { sent: false, queued: true };
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html: textToHtml(body),
        text: body,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Resend error:', resp.status, detail);
      writeOutbox({ to, subject, body, error: `resend ${resp.status}: ${detail}` });
      const err = new Error('Αποτυχία αποστολής email μέσω Resend.');
      err.status = 502;
      throw err;
    }

    const data = await resp.json().catch(() => ({}));
    return { sent: true, id: data.id };
  } catch (e) {
    if (e.status) throw e; // ήδη χειρισμένο σφάλμα Resend
    console.error('Email send exception:', e);
    writeOutbox({ to, subject, body, error: String(e.message) });
    const err = new Error('Σφάλμα κατά την αποστολή email.');
    err.status = 502;
    throw err;
  }
}

// Συμβατότητα προς τα πίσω (παλιές κλήσεις queueEmail).
function queueEmail(entry) {
  return writeOutbox(entry);
}

/* ------------------------------------------------------------------ */
/*  Optional AI proxy (Anthropic)                                      */
/* ------------------------------------------------------------------ */

async function invokeLLM({ prompt, response_json_schema, add_context_from_internet }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error(
      'Το AI δεν είναι ρυθμισμένο. Ορίστε τη μεταβλητή περιβάλλοντος ANTHROPIC_API_KEY στον server.'
    );
    err.status = 501;
    throw err;
  }
  let finalPrompt = prompt;
  if (response_json_schema) {
    finalPrompt +=
      '\n\nΌταν ολοκληρώσεις, απάντησε με ΕΝΑ και μόνο έγκυρο JSON object (χωρίς markdown, χωρίς σχόλια, χωρίς κείμενο πριν ή μετά) που ακολουθεί αυστηρά αυτό το JSON schema:\n' +
      JSON.stringify(response_json_schema);
  }

  const requestBody = {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: finalPrompt }],
  };

  // Προαιρετική αναζήτηση στο web (για πραγματικά προϊόντα/τιμές).
  if (add_context_from_internet) {
    requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`Σφάλμα AI provider (${resp.status}): ${detail.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }
  const data = await resp.json();
  // Μάζεψε όλα τα text blocks (μετά από web search μπορεί να είναι πολλά).
  const text = (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('\n');

  if (!response_json_schema) return { text };

  // Ανθεκτική εξαγωγή JSON: βρες το πρώτο { ... } ακόμα κι αν υπάρχει κείμενο γύρω.
  let clean = text.replace(/```json|```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(clean);
  } catch {
    const err = new Error('Το AI δεν επέστρεψε έγκυρο JSON. Δοκιμάστε ξανά.');
    err.status = 502;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Route handlers                                                     */
/* ------------------------------------------------------------------ */

const routes = [];
function route(method, pattern, handler, { auth = true } = {}) {
  // pattern π.χ. '/api/entities/:name/:id'
  const parts = pattern.split('/').filter(Boolean);
  routes.push({ method, parts, handler, auth });
}

function matchRoute(method, pathname) {
  const segs = pathname.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (r.parts[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { ...r, params };
  }
  return null;
}

/* ---------- Auth ---------- */

route('POST', '/api/auth/register', async ({ body, res }) => {
  const { email, password, full_name } = body;
  if (!email || !password || password.length < 8) {
    return send(res, 400, { error: 'Απαιτείται email και κωδικός τουλάχιστον 8 χαρακτήρων.' });
  }
  const normalized = String(email).trim().toLowerCase();
  if (db.users.some((u) => u.email === normalized)) {
    return send(res, 409, { error: 'Υπάρχει ήδη λογαριασμός με αυτό το email.' });
  }
  const user = newRecord({
    email: normalized,
    password: hashPassword(password),
    full_name: full_name || '',
    role: 'user',
    organization_id: null,
  });
  db.users.push(user);
  saveDb();
  const token = signToken({ sub: user.id });
  send(res, 200, { token, user: publicUser(user) });
}, { auth: false });

route('POST', '/api/auth/login', async ({ body, res }) => {
  const { email, password } = body;
  const user = db.users.find((u) => u.email === String(email || '').trim().toLowerCase());
  if (!user || !verifyPassword(password || '', user.password)) {
    return send(res, 401, { error: 'Λάθος email ή κωδικός.' });
  }
  const token = signToken({ sub: user.id });
  send(res, 200, { token, user: publicUser(user) });
}, { auth: false });

route('GET', '/api/auth/me', async ({ user, res }) => {
  send(res, 200, publicUser(user));
});

route('PATCH', '/api/auth/me', async ({ user, body, res }) => {
  const allowed = ['full_name', 'phone', 'position'];
  for (const k of allowed) if (k in body) user[k] = body[k];

  if ('organization_id' in body && body.organization_id !== user.organization_id) {
    const org = db.organizations.find((o) => o.id === body.organization_id);
    if (!org) return send(res, 400, { error: 'Ο οργανισμός δεν βρέθηκε.' });
    // Μόνο σε οργανισμό που δημιούργησε ο ίδιος (ή admin)
    if (!isAdmin(user) && org.owner_user_id !== user.id) {
      return send(res, 403, { error: 'Δεν επιτρέπεται η σύνδεση σε αυτόν τον οργανισμό.' });
    }
    user.organization_id = body.organization_id;
  }
  user.updated_date = now();
  saveDb();
  send(res, 200, publicUser(user));
});

route('POST', '/api/auth/logout', async ({ res }) => {
  send(res, 200, { ok: true }); // stateless JWT — ο client πετάει το token
}, { auth: false });

route('GET', '/api/auth/users', async ({ user, res }) => {
  if (!isAdmin(user)) return send(res, 403, { error: 'Μόνο για διαχειριστές.' });
  send(res, 200, db.users.map(publicUser));
});

/* ---------- Entities (org-scoped) ---------- */

function resolveCollection(name, res) {
  const collection = ENTITY_MAP[name];
  if (!collection) {
    send(res, 404, { error: `Άγνωστο entity: ${name}` });
    return null;
  }
  return collection;
}

route('POST', '/api/entities/:name/query', async ({ user, params, body, res }) => {
  const collection = resolveCollection(params.name, res);
  if (!collection) return;
  let list = scopedList(user, collection).filter((r) => matches(r, body.where));
  list = applySort(list, body.sort);
  if (body.limit) list = list.slice(0, body.limit);
  send(res, 200, list);
});

route('GET', '/api/entities/:name/:id', async ({ user, params, res }) => {
  const collection = resolveCollection(params.name, res);
  if (!collection) return;
  const record = scopedList(user, collection).find((r) => r.id === params.id);
  if (!record) return send(res, 404, { error: 'Δεν βρέθηκε.' });
  send(res, 200, record);
});

route('POST', '/api/entities/:name', async ({ user, params, body, res }) => {
  const collection = resolveCollection(params.name, res);
  if (!collection) return;
  if (collection !== 'organizations' && !user.organization_id && !isAdmin(user)) {
    return send(res, 400, { error: 'Ο λογαριασμός δεν ανήκει σε οργανισμό ακόμα.' });
  }
  send(res, 200, createEntityRecord(user, collection, body));
});

route('POST', '/api/entities/:name/bulk', async ({ user, params, body, res }) => {
  const collection = resolveCollection(params.name, res);
  if (!collection) return;
  const items = Array.isArray(body.items) ? body.items : [];
  send(res, 200, items.map((item) => createEntityRecord(user, collection, item)));
});

route('PATCH', '/api/entities/:name/:id', async ({ user, params, body, res }) => {
  const collection = resolveCollection(params.name, res);
  if (!collection) return;
  const record = db[collection].find((r) => r.id === params.id);
  if (!record || !canWrite(user, collection, record)) {
    return send(res, 404, { error: 'Δεν βρέθηκε.' });
  }
  // Προστασία: κανείς δεν αλλάζει organization_id/ιδιοκτησία μέσω update
  const { id, organization_id, owner_user_id, created_date, created_by, ...safe } = body;
  Object.assign(record, safe, { updated_date: now() });
  saveDb();
  send(res, 200, record);
});

route('DELETE', '/api/entities/:name/:id', async ({ user, params, res }) => {
  const collection = resolveCollection(params.name, res);
  if (!collection) return;
  const idx = db[collection].findIndex((r) => r.id === params.id);
  if (idx === -1 || !canWrite(user, collection, db[collection][idx])) {
    return send(res, 404, { error: 'Δεν βρέθηκε.' });
  }
  db[collection].splice(idx, 1);
  saveDb();
  send(res, 200, { ok: true });
});

/* ---------- Public endpoints (token-based, χωρίς login) ---------- */

// Client Portal: ένα endpoint που επιστρέφει ΜΟΝΟ τα δεδομένα του πελάτη.
route('POST', '/api/public/portal-login', async ({ body, res }) => {
  const token = String(body.token || '').trim();
  if (!token) return send(res, 400, { error: 'Λείπει ο κωδικός πρόσβασης.' });
  const access = db.client_access.find((a) => a.access_token === token);
  if (!access) return send(res, 404, { error: 'Μη έγκυρος κωδικός πρόσβασης.' });
  if (!access.is_active) return send(res, 403, { error: 'Η πρόσβαση έχει απενεργοποιηθεί.' });
  if (access.expires_at && new Date(access.expires_at) < new Date()) {
    return send(res, 403, { error: 'Η πρόσβαση έχει λήξει.' });
  }
  const client = db.clients.find((c) => c.id === access.client_id);
  if (!client) return send(res, 404, { error: 'Δεν βρέθηκαν στοιχεία πελάτη.' });

  const projects = db.projects.filter((p) => p.client_id === client.id);
  const projectIds = new Set(projects.map((p) => p.id));
  const invoices = db.invoices.filter((i) => i.client_id === client.id);
  const files = db.files.filter((f) => projectIds.has(f.project_id));

  access.last_accessed = now();
  saveDb();
  send(res, 200, { client, projects, invoices, files });
}, { auth: false });

// Δημόσια προβολή έργου (σύνδεσμος κοινοποίησης με UUID)
route('POST', '/api/public/project', async ({ body, res }) => {
  const project = db.projects.find((p) => p.id === body.id);
  if (!project) return send(res, 404, { error: 'Το έργο δεν βρέθηκε.' });
  const organization = db.organizations.find((o) => o.id === project.organization_id) || null;
  send(res, 200, {
    project,
    tasks: db.tasks.filter((t) => t.project_id === project.id),
    payments: db.payments.filter((p) => p.project_id === project.id),
    files: db.files.filter((f) => f.project_id === project.id),
    organization: organization
      ? { id: organization.id, name: organization.name, phone: organization.phone, email: organization.email, logo_url: organization.logo_url }
      : null,
  });
}, { auth: false });

// Δημόσια προβολή προσφοράς μέσω ProposalLink token
route('POST', '/api/public/proposal', async ({ body, res }) => {
  const link = db.proposal_links.find((l) => l.token === String(body.token || ''));
  if (!link) return send(res, 404, { error: 'Ο σύνδεσμος δεν είναι έγκυρος.' });
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return send(res, 403, { error: 'Ο σύνδεσμος έχει λήξει.' });
  }
  const proposal = db.proposals.find((p) => p.id === link.proposal_id);
  if (!proposal) return send(res, 404, { error: 'Η προσφορά δεν βρέθηκε.' });
  const items = db.proposal_items.filter((i) => i.proposal_id === proposal.id);
  const client = db.clients.find((c) => c.id === proposal.client_id) || null;
  const org = db.organizations.find((o) => o.id === proposal.organization_id) || null;
  send(res, 200, {
    proposal,
    items,
    client: client ? { id: client.id, name: client.name } : null,
    organization: org
      ? { id: org.id, name: org.name, phone: org.phone, email: org.email, address: org.address, logo_url: org.logo_url }
      : null,
  });
}, { auth: false });

// Αποδοχή / απόρριψη προσφοράς από τον πελάτη
route('POST', '/api/public/proposal-response', async ({ body, res }) => {
  const link = db.proposal_links.find((l) => l.token === String(body.token || ''));
  if (!link) return send(res, 404, { error: 'Ο σύνδεσμος δεν είναι έγκυρος.' });
  const proposal = db.proposals.find((p) => p.id === link.proposal_id);
  if (!proposal) return send(res, 404, { error: 'Η προσφορά δεν βρέθηκε.' });
  const response = body.response === 'accepted' ? 'accepted' : body.response === 'rejected' ? 'rejected' : null;
  if (!response) return send(res, 400, { error: 'Μη έγκυρη απάντηση.' });
  if (proposal.status === 'accepted' || proposal.status === 'rejected') {
    return send(res, 409, { error: 'Έχει ήδη δοθεί απάντηση σε αυτή την προσφορά.', status: proposal.status });
  }

  proposal.status = response;
  proposal.responded_at = now();
  proposal.accepted_at = response === 'accepted' ? now() : proposal.accepted_at;
  proposal.updated_date = now();

  // Όταν ο πελάτης αποδέχεται από το link, μετατρέπουμε αυτόματα την προσφορά
  // σε πλήρες Έργο (με εργασίες + πληρωμές) — ίδια λογική με την εσωτερική αποδοχή,
  // ώστε να ΜΗΝ "εξαφανίζεται" η προσφορά.
  if (response === 'accepted') {
    try {
      const orgId = proposal.organization_id;
      const today = new Date().toISOString().split('T')[0];

      // Απόφυγε διπλό έργο αν υπάρχει ήδη για αυτή την προσφορά
      let project = db.projects.find((p) => p.proposal_id === proposal.id);
      if (!project) {
        project = newRecord({
          organization_id: orgId,
          client_id: proposal.client_id,
          proposal_id: proposal.id,
          title: proposal.title,
          description: proposal.description || 'Έργο βάσει προσφοράς',
          status: 'active',
          start_date: today,
          budget_total: proposal.total,
          notes: `Δημιουργήθηκε αυτόματα από αποδοχή προσφοράς #${proposal.number} από τον πελάτη`,
        });
        project.created_by = proposal.created_by || 'system';
        db.projects.push(project);

        // Εργασίες από τα items
        const items = db.proposal_items.filter((i) => i.proposal_id === proposal.id);
        for (const item of items) {
          const task = newRecord({
            organization_id: orgId,
            project_id: project.id,
            title: item.description,
            description: `${item.type === 'labor' ? '🔧 Εργασία' : '📦 Υλικό'} - Ποσότητα: ${item.quantity} ${item.unit || 'τεμ.'}, Τιμή: €${item.unit_price}`,
            status: 'todo',
            priority: 'medium',
          });
          task.created_by = project.created_by;
          db.tasks.push(task);
        }

        // Προκαταβολή (αν υπάρχει)
        if (proposal.has_advance && proposal.advance_amount > 0) {
          const advance = newRecord({
            organization_id: orgId,
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
          });
          advance.created_by = project.created_by;
          db.payments.push(advance);
        }

        // Υπόλοιπο
        const remaining = (proposal.total || 0) - (proposal.advance_amount || 0);
        if (remaining > 0) {
          const due = new Date();
          due.setDate(due.getDate() + 30);
          const payment = newRecord({
            organization_id: orgId,
            project_id: project.id,
            client_id: proposal.client_id,
            title: `Υπόλοιπο πληρωμή για ${proposal.title}`,
            amount: remaining,
            currency: proposal.currency || 'EUR',
            due_date: due.toISOString().split('T')[0],
            status: 'pending',
            notes: `Υπόλοιπο πληρωμή από προσφορά #${proposal.number}`,
          });
          payment.created_by = project.created_by;
          db.payments.push(payment);
        }
      }
    } catch (e) {
      console.error('⚠️ Αυτόματη μετατροπή σε έργο απέτυχε (η αποδοχή καταγράφηκε):', e);
    }
  }

  saveDb();
  send(res, 200, { ok: true, status: response });
}, { auth: false });

/* ---------- Functions (πρώην Base44 functions) ---------- */

function ensureProposalLink(proposalId) {
  let link = db.proposal_links.find((l) => l.proposal_id === proposalId);
  if (!link) {
    link = newRecord({ proposal_id: proposalId, token: crypto.randomUUID() });
    db.proposal_links.push(link);
    saveDb();
  }
  return link;
}

route('POST', '/api/functions/sendProposalEmail', async ({ user, body, res }) => {
  const proposal = scopedList(user, 'proposals').find((p) => p.id === body.proposalId);
  if (!proposal) return send(res, 404, { error: 'Η προσφορά δεν βρέθηκε.' });
  const client = scopedList(user, 'clients').find((c) => c.id === proposal.client_id);
  if (!client?.email) {
    return send(res, 400, { error: 'Ο πελάτης δεν έχει καταχωρημένο email.' });
  }
  const org = db.organizations.find((o) => o.id === proposal.organization_id);
  const link = ensureProposalLink(proposal.id);
  const publicUrl = `${body.origin || ''}/proposalpdf?token=${link.token}`;

  const result = await sendEmail({
    to: client.email,
    replyTo: org?.email || undefined,
    subject: `Προσφορά #${proposal.number || ''} από ${org?.name || 'Jobix'}`,
    body: `Αγαπητέ/ή ${client.name || ''},\n\nΣας ευχαριστούμε για το ενδιαφέρον σας. Μπορείτε να δείτε την προσφορά μας και να την αποδεχτείτε ή να την απορρίψετε από τον παρακάτω σύνδεσμο:\n\n${publicUrl}\n\nΜε εκτίμηση,\n${org?.name || 'Jobix'}`,
  });

  send(res, 200, { emailSent: result.sent === true, queued: !!result.queued, publicUrl });
});

route('POST', '/api/functions/sendInvoiceEmail', async ({ user, body, res }) => {
  const invoice = scopedList(user, 'invoices').find((i) => i.id === body.invoiceId);
  if (!invoice) return send(res, 404, { error: 'Το παραστατικό δεν βρέθηκε.' });
  const to = invoice.client_details?.email;
  if (!to) return send(res, 400, { error: 'Ο πελάτης δεν έχει καταχωρημένο email.' });
  const org = db.organizations.find((o) => o.id === invoice.organization_id);

  const result = await sendEmail({
    to,
    replyTo: org?.email || undefined,
    subject: `Παραστατικό #${invoice.number || ''} από ${org?.name || 'Jobix'}`,
    body: `Αγαπητέ/ή ${invoice.client_details?.name || ''},\n\nΤο παραστατικό #${invoice.number || ''} από ${org?.name || 'Jobix'} έχει εκδοθεί.\n\nΜε εκτίμηση,\n${org?.name || 'Jobix'}`,
  });

  send(res, 200, { emailSent: result.sent === true, queued: !!result.queued });
});

route('POST', '/api/functions/subscribeToPush', async ({ res }) => {
  send(res, 200, { supported: false });
});
route('POST', '/api/functions/sendPushNotifications', async ({ res }) => {
  send(res, 200, { supported: false });
});

/* ---------- Integrations ---------- */

route('POST', '/api/integrations/upload', async ({ body, res }) => {
  const { name = 'file', type = 'application/octet-stream', data } = body;
  if (!data) return send(res, 400, { error: 'Λείπει το αρχείο.' });
  const buf = Buffer.from(data, 'base64');
  if (buf.length > 20 * 1024 * 1024) return send(res, 413, { error: 'Το αρχείο ξεπερνά τα 20MB.' });
  const safeExt = path.extname(name).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10);
  const filename = `${crypto.randomUUID()}${safeExt}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  send(res, 200, { file_url: `/uploads/${filename}`, name, type, size: buf.length });
});

route('POST', '/api/integrations/invoke-llm', async ({ body, res }) => {
  try {
    const result = await invokeLLM(body);
    send(res, 200, result);
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/*  Server                                                             */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS (χρήσιμο μόνο αν frontend/server τρέχουν σε άλλα origins)
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // Στατικά uploads
  if (pathname.startsWith('/uploads/')) {
    const file = path.normalize(path.join(UPLOADS_DIR, pathname.slice('/uploads/'.length)));
    if (!file.startsWith(UPLOADS_DIR)) return send(res, 403, { error: 'Forbidden' });
    return serveFile(res, file);
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    const match = matchRoute(req.method, pathname);
    if (!match) return send(res, 404, { error: 'Not found' });
    let body = {};
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      try { body = await readBody(req); }
      catch (e) { return send(res, 400, { error: e.message }); }
    }
    let user = null;
    if (match.auth) {
      user = getAuthUser(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
    }
    try {
      return await match.handler({ req, res, body, user, params: match.params, url });
    } catch (e) {
      console.error('Handler error:', e);
      return send(res, 500, { error: 'Εσωτερικό σφάλμα server.' });
    }
  }

  // Production: σερβίρισμα του χτισμένου frontend (SPA fallback)
  if (fs.existsSync(DIST_DIR)) {
    const candidate = path.normalize(path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname));
    if (candidate.startsWith(DIST_DIR) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveFile(res, candidate);
    }
    return serveFile(res, path.join(DIST_DIR, 'index.html'));
  }

  send(res, 404, { error: 'Not found. (Σε development τρέξτε και το vite: npm run dev)' });
});

server.listen(PORT, () => {
  console.log(`✅ Jobix backend: http://localhost:${PORT}`);
  console.log(`   Δεδομένα: ${DB_FILE}`);
  console.log(`   AI (InvokeLLM): ${process.env.ANTHROPIC_API_KEY ? 'ενεργό' : 'ανενεργό (ορίστε ANTHROPIC_API_KEY)'}`);
  console.log(`   Email (Resend): ${RESEND_API_KEY ? `ενεργό — αποστολέας ${EMAIL_FROM}` : 'ανενεργό (ορίστε RESEND_API_KEY) — γράφει σε server/outbox/'}`);
});

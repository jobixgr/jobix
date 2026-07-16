// Κοινές συναρτήσεις για όλα τα serverless functions του Jobix.
// - JWT (HS256) auth χωρίς εξαρτήσεις
// - scrypt password hashing
// - Supabase REST client (μέσω service_role key) με έλεγχο multi-tenancy
//
// Απαιτούμενες μεταβλητές περιβάλλοντος (Vercel → Settings → Environment Variables):
//   SUPABASE_URL           = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE  = το service_role key (ΜΥΣΤΙΚΟ — ποτέ στο frontend)
//   JWT_SECRET             = οποιαδήποτε τυχαία μεγάλη συμβολοσειρά
//   RESEND_API_KEY         = (προαιρετικό) για email
//   ANTHROPIC_API_KEY      = (προαιρετικό) για AI

import crypto from 'node:crypto';

// Ασφάλεια: το JWT_SECRET είναι υποχρεωτικό. Σε production, αν λείπει ή είναι
// αδύναμο, η εφαρμογή αρνείται να λειτουργήσει (δεν υπάρχει επικίνδυνο fallback).
const JWT_SECRET = (() => {
  const s = process.env.JWT_SECRET;
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (!s || s.length < 32) {
    const msg = 'ΚΡΙΣΙΜΟ: Λείπει ή είναι πολύ αδύναμο το JWT_SECRET (χρειάζονται ≥32 χαρακτήρες). Ορίστε το στα Environment Variables.';
    if (isProd) {
      // Σε production δεν επιτρέπουμε λειτουργία με ανασφαλές secret.
      throw new Error(msg);
    }
    console.warn('⚠️ ' + msg + ' (χρήση προσωρινού secret μόνο για τοπική ανάπτυξη)');
    return s || 'dev-only-insecure-secret-do-not-use-in-production-0000';
  }
  return s;
})();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;

/* ---------------- Entity map (frontend name -> table) ---------------- */

export const ENTITY_MAP = {
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
  ProjectLink: 'project_links',
  Appointment: 'appointments',
  Expense: 'expenses',
  ClientAccess: 'client_access',
  // Jobix Care — συμβόλαια συντήρησης
  CarePlan: 'care_plans',
  CareContract: 'care_contracts',
  CareVisit: 'care_visits',
  CareLink: 'care_links',
};

/* ---------------- JWT ---------------- */

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (obj) => b64url(JSON.stringify(obj));

export function signToken(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const data = `${head}.${b64urlJson(body)}`;
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token) {
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

/* ---------------- Passwords (scrypt) ---------------- */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
  } catch {
    return false;
  }
}

/* ---------------- Supabase REST ---------------- */

async function sb(path, { method = 'GET', body, prefer } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Λείπουν οι μεταβλητές SUPABASE_URL / SUPABASE_SERVICE_ROLE.');
  }
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.message) || `Supabase error ${res.status}`);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

// Χαμηλού επιπέδου helpers (χρησιμοποιούνται από τα function handlers)
export const supa = {
  // SELECT με φίλτρα PostgREST (π.χ. { organization_id: 'eq.<uuid>' })
  async select(table, filters = {}, { order, limit } = {}) {
    const params = new URLSearchParams({ select: '*' });
    for (const [k, v] of Object.entries(filters)) params.append(k, v);
    if (order) params.append('order', order);
    if (limit) params.append('limit', String(limit));
    return sb(`${table}?${params.toString()}`);
  },
  async insert(table, row) {
    const rows = await sb(table, { method: 'POST', body: row, prefer: 'return=representation' });
    return Array.isArray(rows) ? rows[0] : rows;
  },
  async update(table, id, patch) {
    const rows = await sb(`${table}?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
    return Array.isArray(rows) ? rows[0] : rows;
  },
  async remove(table, id) {
    await sb(`${table}?id=eq.${id}`, { method: 'DELETE' });
    return { ok: true };
  },
};

/* ---------------- Record shaping (flatten JSONB data) ---------------- */

// Στη βάση κρατάμε σταθερά πεδία + data(JSONB). Το frontend περιμένει "επίπεδο"
// αντικείμενο. Οι δύο συναρτήσεις μετατρέπουν μπρος-πίσω.

const FIXED = new Set(['id', 'organization_id', 'owner_user_id', 'created_by', 'created_date', 'updated_date']);

export function toClient(row) {
  if (!row) return row;
  const { data, ...rest } = row;
  return { ...(data || {}), ...rest };
}

export function toData(obj) {
  const data = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (!FIXED.has(k)) data[k] = v;
  }
  return data;
}

/* ---------------- Auth from request ---------------- */

export async function getUserFromReq(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const rows = await supa.select('app_users', { id: `eq.${payload.sub}` });
  return rows && rows[0] ? rows[0] : null;
}

// Επιστρέφει ΜΟΝΟ τα πεδία που επιτρέπεται να δει ο client (allowlist).
// ΑΣΦΑΛΕΙΑ: με denylist ({password, ...rest}) διέρρεαν reset_token/verify_token,
// που επιτρέπουν αλλαγή κωδικού / επιβεβαίωση email. Ποτέ ξανά.
const USER_PUBLIC_FIELDS = [
  'id', 'email', 'full_name', 'phone', 'position',
  'role', 'organization_id', 'email_verified',
  'created_date', 'updated_date',
];

export function publicUser(u) {
  if (!u) return null;
  const out = {};
  for (const f of USER_PUBLIC_FIELDS) {
    if (u[f] !== undefined) out[f] = u[f];
  }
  return out;
}

export const isAdmin = (u) => u && u.role === 'super_admin';

/* ---------------- HTTP helpers ---------------- */

export function send(res, status, body) {
  res.status(status).json(body);
}

export async function readJson(req) {
  // Στο Vercel το req.body είναι ήδη parsed για JSON. Fallback αν όχι.
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

// Επιτρεπόμενα origins για CORS. Ορίζονται στο env ALLOWED_ORIGINS
// (comma-separated), π.χ. "https://jobix.gr,https://www.jobix.gr".
// Αν δεν οριστεί, σε μη-production επιτρέπεται localhost για ανάπτυξη.
function allowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (!isProd) {
    list.push('http://localhost:5173', 'http://localhost:4000', 'http://127.0.0.1:5173');
  }
  return list;
}

// Βάζει CORS (περιορισμένο) + όλα τα security headers.
export function applyCors(res, req) {
  const origins = allowedOrigins();
  const reqOrigin = req && (req.headers.origin || req.headers.Origin);

  if (origins.length === 0) {
    // Καμία ρύθμιση: πιο ασφαλές να ΜΗΝ στέλνουμε ACAO καθόλου.
    // (Οι same-origin κλήσεις του frontend δεν χρειάζονται CORS.)
  } else if (reqOrigin && origins.includes(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!reqOrigin) {
    // same-origin ή server-to-server — δεν χρειάζεται ACAO
  }
  // Αν το origin δεν είναι στη λίστα, ΔΕΝ στέλνουμε ACAO → ο browser μπλοκάρει.

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

  applySecurityHeaders(res);
}

// Security headers που μπαίνουν σε κάθε API response.
export function applySecurityHeaders(res) {
  // Αποτρέπει MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Έλεγχος πληροφορίας referrer
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Περιορισμός επικίνδυνων browser APIs
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self)');
  // Anti-clickjacking (τα API δεν πρέπει να φορτώνονται σε iframe)
  res.setHeader('X-Frame-Options', 'DENY');
  // HSTS — force HTTPS για 1 χρόνο (μόνο σε production/https)
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

export const now = () => new Date().toISOString();

/* ---------------- Email (Resend) ---------------- */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Jobix <offers@jobix.gr>';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function textToHtml(body) {
  const withLinks = escapeHtml(body).replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" style="color:#2563eb">$1</a>'
  );
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">${withLinks.replace(/\n/g, '<br>')}</div>`;
}

export async function sendEmail({ to, subject, body, replyTo }) {
  if (!to) return { sent: false, error: 'no-recipient' };
  if (!RESEND_API_KEY) {
    const err = new Error('Το email δεν είναι ρυθμισμένο (λείπει RESEND_API_KEY).');
    err.status = 501;
    throw err;
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
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
    const err = new Error('Αποτυχία αποστολής email μέσω Resend.');
    err.status = 502;
    throw err;
  }
  const data = await resp.json().catch(() => ({}));
  return { sent: true, id: data.id };
}

/* ---------------- AI (Anthropic, με προαιρετικό web search) ---------------- */

export async function invokeLLM({ prompt, response_json_schema, add_context_from_internet }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('Το AI δεν είναι ρυθμισμένο. Ορίστε ANTHROPIC_API_KEY στον server.');
    err.status = 501;
    throw err;
  }
  let finalPrompt = prompt;
  if (response_json_schema) {
    finalPrompt += '\n\nΌταν ολοκληρώσεις, απάντησε με ΕΝΑ και μόνο έγκυρο JSON object (χωρίς markdown, χωρίς σχόλια, χωρίς κείμενο πριν ή μετά) που ακολουθεί αυστηρά αυτό το JSON schema:\n' + JSON.stringify(response_json_schema);
  }
  const requestBody = {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: finalPrompt }],
  };
  if (add_context_from_internet) {
    requestBody.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }];
  }
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(requestBody),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`Σφάλμα AI provider (${resp.status}): ${detail.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }
  const data = await resp.json();
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n');
  if (!response_json_schema) return { text };
  let clean = text.replace(/```json|```/g, '').trim();
  const f = clean.indexOf('{'), l = clean.lastIndexOf('}');
  if (f !== -1 && l !== -1 && l > f) clean = clean.slice(f, l + 1);
  try { return JSON.parse(clean); }
  catch { const err = new Error('Το AI δεν επέστρεψε έγκυρο JSON. Δοκιμάστε ξανά.'); err.status = 502; throw err; }
}

export { crypto };

/* ---------------- Rate limiting (Ενότητα 2) ---------------- */

// Καλεί οποιαδήποτε SQL function (RPC) του Supabase. Σε αντίθεση με το rlHit,
// ΔΕΝ κάνει fail-open: αν αποτύχει, πετάει σφάλμα — γιατί χρησιμοποιείται για
// κρίσιμες λειτουργίες (π.χ. atomic αποδοχή προσφοράς) όπου η σιωπηλή αποτυχία
// θα άφηνε τα δεδομένα μισοτελειωμένα.
export async function rpc(fnName, params = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase not configured');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${fnName} απέτυχε (${res.status}): ${text.slice(0, 200)}`);
  }
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

// Καλεί την SQL function rl_hit (ατομική αύξηση). Επιστρέφει το τρέχον count
// στο παράθυρο. Αν κάτι πάει στραβά (π.χ. δεν έχει τρέξει το νέο schema),
// επιστρέφει 0 ώστε να ΜΗΝ μπλοκάρει άδικα (fail-open) — αλλά καταγράφει το σφάλμα.
async function rlHit(bucketKey, windowStart) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return 0;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rl_hit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_key: bucketKey, p_window_start: windowStart }),
    });
    if (!res.ok) {
      console.error('rate limit rpc error:', res.status, await res.text().catch(() => ''));
      return 0;
    }
    const data = await res.json();
    return typeof data === 'number' ? data : 0;
  } catch (e) {
    console.error('rate limit exception:', e.message);
    return 0;
  }
}

// Βρίσκει το IP του αιτούντος (πίσω από το proxy του Vercel).
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'] || '';
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Ελέγχει και "χτυπάει" ένα rate limit.
//   name:        λογικό όνομα (π.χ. 'login')
//   identifier:  IP ή userId
//   limit:       μέγιστες επιτρεπτές κλήσεις στο παράθυρο
//   windowSec:   μέγεθος παραθύρου σε δευτερόλεπτα
// Επιστρέφει { allowed, remaining, retryAfterSec }.
export async function checkRateLimit({ name, identifier, limit, windowSec }) {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  // Στρογγυλοποίηση στην αρχή του παραθύρου (fixed-window)
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const bucketKey = `${name}:${identifier}`;

  const count = await rlHit(bucketKey, windowStart);
  if (count === 0) {
    // fail-open (π.χ. δεν έχει τρέξει το schema) — μην μπλοκάρεις
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
  const allowed = count <= limit;
  const retryAfterSec = allowed ? 0 : Math.ceil((windowStartMs + windowMs - now) / 1000);
  return { allowed, remaining: Math.max(0, limit - count), retryAfterSec };
}

// Βοηθός: εφαρμόζει rate limit και, αν ξεπεραστεί, στέλνει 429 και επιστρέφει true.
export async function enforceRateLimit(req, res, { name, identifier, limit, windowSec }) {
  const result = await checkRateLimit({ name, identifier, limit, windowSec });
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    send(res, 429, {
      error: `Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά σε ${result.retryAfterSec} δευτερόλεπτα.`,
    });
    return true; // blocked
  }
  return false; // allowed
}

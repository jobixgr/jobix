// Ενιαίο API entry point για το Jobix.
// Ένα μόνο serverless function που δρομολογεί ΟΛΑ τα /api/* εσωτερικά,
// ώστε να αποφύγουμε προβλήματα με ονόματα αρχείων [...path].js.
import {
  ENTITY_MAP, supa, toClient, toData, signToken, hashPassword, verifyPassword,
  getUserFromReq, publicUser, isAdmin, send, readJson, applyCors, now,
  enforceRateLimit, clientIp, sendEmail, invokeLLM, rpc,
} from './_lib/core.js';
import crypto from 'node:crypto';

const first = (arr) => (arr && arr[0] ? arr[0] : null);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = process.env.SUPABASE_BUCKET || 'jobix-uploads';

// ΑΣΦΑΛΕΙΑ: η βάση για ΟΛΑ τα links που στέλνονται με email.
// ΠΟΤΕ δεν παίρνεται από τον χρήστη (req.headers.origin ή body.origin) — αλλιώς
// επιτιθέμενος θα μπορούσε να στείλει origin=evil.com και να κλέψει reset tokens.
// Παίρνει το πρώτο από το ALLOWED_ORIGINS, ή το APP_URL αν οριστεί ρητά.
const APP_URL = (() => {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const first = (process.env.ALLOWED_ORIGINS || '').split(',')[0].trim();
  if (first) return first.replace(/\/$/, '');
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (isProd) {
    console.error('ΠΡΟΣΟΧΗ: δεν ορίστηκε APP_URL/ALLOWED_ORIGINS — τα email links θα είναι σπασμένα.');
    return '';
  }
  return 'http://localhost:5173';
})();

async function ensureProjectLink(projectId, orgId, createdBy) {
  const existing = (await supa.select('project_links', { 'data->>project_id': `eq.${projectId}` })).map(toClient);
  if (existing.length) return existing[0];
  const row = await supa.insert('project_links', {
    organization_id: orgId,
    created_by: createdBy || 'system',
    data: { project_id: projectId, token: crypto.randomUUID() },
  });
  return toClient(row);
}

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

// Επιτρεπόμενοι τύποι αρχείων. Ό,τι δεν είναι εδώ, απορρίπτεται.
// (Αποτρέπει ανέβασμα εκτελέσιμων/scripts που θα μπορούσαν να σερβιριστούν.)
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — πραγματικό όριο πλέον

function safeExt(name) {
  const m = String(name || '').match(/\.[a-zA-Z0-9]{1,10}$/);
  return m ? m[0].toLowerCase() : '';
}

// Δημιουργεί signed URL ώστε ο BROWSER να ανεβάσει ΑΠΕΥΘΕΙΑΣ στο Supabase.
// ΓΙΑΤΙ: τα Vercel functions έχουν όριο ~4.5MB στο request body. Το παλιό
// base64-σε-JSON έσπαγε σε αρχεία >3MB, παρότι ο κώδικας διαφήμιζε 20MB.
async function createSignedUploadUrl({ name, type, size }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const err = new Error('Λείπουν οι μεταβλητές Supabase.'); err.status = 501; throw err;
  }
  if (!ALLOWED_MIME.has(type)) {
    const err = new Error(`Ο τύπος αρχείου "${type || 'άγνωστος'}" δεν επιτρέπεται.`);
    err.status = 415; throw err;
  }
  if (!size || size > MAX_UPLOAD_BYTES) {
    const err = new Error(`Το αρχείο ξεπερνά το όριο των ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
    err.status = 413; throw err;
  }
  const objectPath = `${new Date().getFullYear()}/${crypto.randomUUID()}${safeExt(name)}`;
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    const d = await resp.text().catch(() => '');
    console.error('signed upload url error:', resp.status, d);
    const err = new Error('Αποτυχία προετοιμασίας ανεβάσματος.'); err.status = 502; throw err;
  }
  const json = await resp.json();
  // Το Supabase επιστρέφει π.χ. { url: "/object/upload/sign/bucket/path?token=..." }
  const uploadUrl = `${SUPABASE_URL}/storage/v1${json.url.startsWith('/') ? json.url : '/' + json.url}`;
  return { uploadUrl, path: objectPath, token: json.token };
}

// Προσωρινό URL για ΑΝΑΓΝΩΣΗ ιδιωτικού αρχείου (default 1 ώρα).
async function createSignedDownloadUrl(objectPath, expiresIn = 3600) {
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!resp.ok) {
    const d = await resp.text().catch(() => '');
    console.error('sign download error:', resp.status, d);
    return null;
  }
  const json = await resp.json();
  const signed = json.signedURL || json.signedUrl || '';
  return signed ? `${SUPABASE_URL}/storage/v1${signed.startsWith('/') ? signed : '/' + signed}` : null;
}

// Διαγράφει το πραγματικό αρχείο από το Storage (file cleanup).
async function deleteFromStorage(objectPath) {
  if (!objectPath) return false;
  try {
    const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY },
    });
    return resp.ok;
  } catch (e) {
    console.error('storage delete error:', e);
    return false;
  }
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
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const user = await supa.insert('app_users', {
        email: normalized,
        password: hashPassword(password),
        full_name: full_name || '',
        role: 'user',
        organization_id: null,
        email_verified: false,
        verify_token: verifyToken,
      });
      // Στείλε email επιβεβαίωσης (δεν μπλοκάρει την εγγραφή αν αποτύχει).
      try {
        const verifyLink = `${APP_URL}/verify-email?token=${verifyToken}`;
        await sendEmail({
          to: normalized,
          subject: 'Επιβεβαίωση email — Jobix',
          body: `Καλώς ήρθατε στο Jobix!\n\nΠατήστε τον παρακάτω σύνδεσμο για να επιβεβαιώσετε το email σας:\n\n${verifyLink}\n\nΑν δεν δημιουργήσατε εσείς λογαριασμό, αγνοήστε αυτό το email.\n\nΜε εκτίμηση,\nJobix`,
        });
      } catch (e) {
        console.error('verify email send error:', e);
      }
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
          email_verified: true,  // η Google εγγυάται το email
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

    // ---------- FORGOT PASSWORD (στέλνει email με link) ----------
    if (action === 'forgot-password' && req.method === 'POST') {
      // Προστασία: max 5 αιτήματα ανά IP / 15 λεπτά
      if (await enforceRateLimit(req, res, { name: 'forgot-pw', identifier: clientIp(req), limit: 5, windowSec: 900 })) return;
      const { email } = await readJson(req);
      const normalized = String(email || '').trim().toLowerCase();
      // Για ασφάλεια, ΠΑΝΤΑ επιστρέφουμε ok (να μην αποκαλύπτουμε ποια emails υπάρχουν).
      const user = first(await supa.select('app_users', { email: `eq.${normalized}` }));
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 ώρα
        await supa.update('app_users', user.id, { reset_token: token, reset_expires: expires });
        const link = `${APP_URL}/reset-password?token=${token}`;
        try {
          await sendEmail({
            to: normalized,
            subject: 'Επαναφορά κωδικού — Jobix',
            body: `Λάβαμε αίτημα επαναφοράς κωδικού για τον λογαριασμό σας.\n\nΠατήστε τον παρακάτω σύνδεσμο για να ορίσετε νέο κωδικό (ισχύει για 1 ώρα):\n\n${link}\n\nΑν δεν ζητήσατε εσείς επαναφορά, αγνοήστε αυτό το email.\n\nΜε εκτίμηση,\nJobix`,
          });
        } catch (e) {
          console.error('forgot-password email error:', e);
        }
      }
      return send(res, 200, { ok: true, message: 'Αν υπάρχει λογαριασμός με αυτό το email, στάλθηκε σύνδεσμος επαναφοράς.' });
    }

    // ---------- RESET PASSWORD (βάζει νέο κωδικό με το token) ----------
    if (action === 'reset-password' && req.method === 'POST') {
      if (await enforceRateLimit(req, res, { name: 'reset-pw', identifier: clientIp(req), limit: 10, windowSec: 900 })) return;
      const { token, password } = await readJson(req);
      if (!token || !password || password.length < 8) {
        return send(res, 400, { error: 'Απαιτείται έγκυρο token και κωδικός τουλάχιστον 8 χαρακτήρων.' });
      }
      const user = first(await supa.select('app_users', { reset_token: `eq.${token}` }));
      if (!user || !user.reset_expires || new Date(user.reset_expires) < new Date()) {
        return send(res, 400, { error: 'Ο σύνδεσμος επαναφοράς είναι άκυρος ή έχει λήξει. Ζητήστε νέο.' });
      }
      await supa.update('app_users', user.id, {
        password: hashPassword(password),
        reset_token: null,
        reset_expires: null,
        updated_date: now(),
      });
      return send(res, 200, { ok: true, message: 'Ο κωδικός άλλαξε. Μπορείτε τώρα να συνδεθείτε.' });
    }

    // ---------- VERIFY EMAIL (με το token από το email) ----------
    if (action === 'verify-email' && req.method === 'POST') {
      const { token } = await readJson(req);
      if (!token) return send(res, 400, { error: 'Λείπει το token.' });
      const user = first(await supa.select('app_users', { verify_token: `eq.${token}` }));
      if (!user) return send(res, 400, { error: 'Ο σύνδεσμος επιβεβαίωσης είναι άκυρος ή έχει ήδη χρησιμοποιηθεί.' });
      await supa.update('app_users', user.id, {
        email_verified: true,
        verify_token: null,
        updated_date: now(),
      });
      return send(res, 200, { ok: true, message: 'Το email επιβεβαιώθηκε!' });
    }

    // ---------- RESEND VERIFICATION (ξαναστέλνει το email) ----------
    if (action === 'resend-verification' && req.method === 'POST') {
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
      if (await enforceRateLimit(req, res, { name: 'resend-verify', identifier: user.id, limit: 3, windowSec: 900 })) return;
      if (user.email_verified) return send(res, 200, { ok: true, message: 'Το email είναι ήδη επιβεβαιωμένο.' });
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await supa.update('app_users', user.id, { verify_token: verifyToken });
      try {
        const verifyLink = `${APP_URL}/verify-email?token=${verifyToken}`;
        await sendEmail({
          to: user.email,
          subject: 'Επιβεβαίωση email — Jobix',
          body: `Πατήστε τον παρακάτω σύνδεσμο για να επιβεβαιώσετε το email σας:\n\n${verifyLink}\n\nΜε εκτίμηση,\nJobix`,
        });
      } catch (e) {
        console.error('resend verify error:', e);
        return send(res, 502, { error: 'Αποτυχία αποστολής email.' });
      }
      return send(res, 200, { ok: true, message: 'Στάλθηκε νέο email επιβεβαίωσης.' });
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

    // ---------- CHANGE PASSWORD (συνδεδεμένος χρήστης) ----------
    if (action === 'change-password' && req.method === 'POST') {
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
      const { currentPassword, newPassword } = await readJson(req);
      if (!newPassword || newPassword.length < 8) {
        return send(res, 400, { error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' });
      }
      // Αν ο λογαριασμός έχει κωδικό (όχι μόνο-Google), απαίτησε τον τρέχοντα.
      const isGoogleOnly = user.password === 'google-oauth-no-password';
      if (!isGoogleOnly) {
        if (!currentPassword || !verifyPassword(currentPassword, user.password)) {
          return send(res, 400, { error: 'Ο τρέχων κωδικός είναι λάθος.' });
        }
      }
      await supa.update('app_users', user.id, {
        password: hashPassword(newPassword),
        updated_date: now(),
      });
      return send(res, 200, { ok: true, message: 'Ο κωδικός άλλαξε επιτυχώς.' });
    }

    // ---------- CHANGE EMAIL (συνδεδεμένος χρήστης) ----------
    if (action === 'change-email' && req.method === 'POST') {
      const user = await getUserFromReq(req);
      if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
      const { newEmail, currentPassword } = await readJson(req);
      const normalized = String(newEmail || '').trim().toLowerCase();
      if (!normalized || !normalized.includes('@')) {
        return send(res, 400, { error: 'Μη έγκυρο email.' });
      }
      // Επιβεβαίωση ταυτότητας με κωδικό (εκτός αν είναι μόνο-Google).
      const isGoogleOnly = user.password === 'google-oauth-no-password';
      if (!isGoogleOnly) {
        if (!currentPassword || !verifyPassword(currentPassword, user.password)) {
          return send(res, 400, { error: 'Ο κωδικός είναι λάθος.' });
        }
      }
      // Έλεγχος ότι το νέο email δεν χρησιμοποιείται ήδη.
      const existing = first(await supa.select('app_users', { email: `eq.${normalized}` }));
      if (existing && existing.id !== user.id) {
        return send(res, 409, { error: 'Το email χρησιμοποιείται ήδη από άλλον λογαριασμό.' });
      }
      const updated = await supa.update('app_users', user.id, {
        email: normalized,
        email_verified: false,
        updated_date: now(),
      });
      return send(res, 200, { ok: true, user: publicUser(updated), message: 'Το email άλλαξε.' });
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
      const filters = {};
      // where: ισότητες πάνω σε δυναμικά πεδία (data->>key) ή σταθερά.
      // ΑΣΦΑΛΕΙΑ: το organization_id ΔΕΝ επιτρέπεται από τον χρήστη — αλλιώς
      // θα μπορούσε να δει δεδομένα άλλου οργανισμού (data leak).
      if (body.where) {
        for (const [k, v] of Object.entries(body.where)) {
          if (k === 'organization_id') continue;  // αγνοείται πάντα
          if (['id', 'created_by'].includes(k)) {
            filters[k] = `eq.${v}`;
          } else {
            filters[`data->>${k}`] = `eq.${v}`;
          }
        }
      }
      // Το φίλτρο ασφαλείας μπαίνει ΤΕΛΕΥΤΑΙΟ ώστε να μην μπορεί να αντικατασταθεί.
      Object.assign(filters, orgFilter());
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

      // File cleanup: αν είναι αρχείο, σβήσε και το πραγματικό object από το
      // Storage — αλλιώς θα συσσωρεύονταν ορφανά αρχεία που πληρώνεις.
      if (table === 'files') {
        const p = (row.data || {}).storage_path;
        if (p) await deleteFromStorage(p);
      }

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
      // Οι γραμμές των παραστατικών, ώστε ο πελάτης να μπορεί να δει τι χρεώθηκε.
      const invoiceIds = new Set(invoices.map((i) => i.id));
      const allItems = invoiceIds.size
        ? (await supa.select('invoice_items', { organization_id: `eq.${client.organization_id}` })).map(toClient)
        : [];
      const invoiceItems = allItems.filter((it) => invoiceIds.has(it.invoice_id));
      const allFiles = (await supa.select('files', { organization_id: `eq.${client.organization_id}` })).map(toClient);
      const clientFiles = allFiles.filter((f) => projectIds.has(f.project_id));
      // Signed URLs (1 ώρα) — το bucket είναι πλέον ιδιωτικό.
      const files = await Promise.all(clientFiles.map(async (f) => ({
        ...f,
        url: f.storage_path ? await createSignedDownloadUrl(f.storage_path) : null,
      })));

      await supa.update('client_access', access.id, { data: { ...access, last_accessed: now() } });
      return send(res, 200, { client, projects, invoices, invoiceItems, files });
    }

    // ---------- PUBLIC PROJECT ----------
    // ΑΣΦΑΛΕΙΑ: δέχεται ΜΟΝΟ token, ποτέ το project id. Με το id, οποιοσδήποτε
    // το αποκτούσε (logs, screenshot, ιστορικό) έβλεπε πληρωμές και αρχεία.
    if (action === 'project') {
      const token = String(body.token || '').trim();
      if (!token) return send(res, 400, { error: 'Λείπει ο σύνδεσμος.' });
      const link = toClient(first(await supa.select('project_links', { 'data->>token': `eq.${token}` })));
      if (!link) return send(res, 404, { error: 'Ο σύνδεσμος δεν είναι έγκυρος.' });
      if (link.is_active === false) return send(res, 403, { error: 'Ο σύνδεσμος έχει απενεργοποιηθεί.' });

      const project = toClient(first(await supa.select('projects', { id: `eq.${link.project_id}` })));
      if (!project) return send(res, 404, { error: 'Το έργο δεν βρέθηκε.' });
      const org = toClient(first(await supa.select('organizations', { id: `eq.${project.organization_id}` })));
      const tasks = (await supa.select('tasks', { 'data->>project_id': `eq.${project.id}` })).map(toClient);
      const payments = (await supa.select('payments', { 'data->>project_id': `eq.${project.id}` })).map(toClient);
      const rawFiles = (await supa.select('files', { 'data->>project_id': `eq.${project.id}` })).map(toClient);
      // Τα αρχεία είναι ιδιωτικά: δίνουμε προσωρινά signed URLs (1 ώρα) ώστε
      // η δημόσια σελίδα να μπορεί να τα εμφανίσει χωρίς να είναι το bucket public.
      const files = await Promise.all(rawFiles.map(async (f) => ({
        ...f,
        url: f.storage_path ? await createSignedDownloadUrl(f.storage_path) : null,
      })));
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

      // ---- ΑΠΟΡΡΙΨΗ: απλή ενημέρωση status ----
      if (response === 'rejected') {
        const newData = { ...(proposalRow.data || {}), status: 'rejected', responded_at: now() };
        await supa.update('proposals', proposal.id, { data: newData, updated_date: now() });
        return send(res, 200, { ok: true, status: 'rejected' });
      }

      // ---- ΑΠΟΔΟΧΗ: ΟΛΑ σε μία SQL transaction ----
      // Η function accept_proposal κάνει atomically: status + έργο + εργασίες + προκαταβολή.
      // Είτε ολοκληρώνονται όλα, είτε τίποτα. Το unique index εμποδίζει διπλά έργα
      // ακόμα και σε ταυτόχρονα requests.
      let result;
      try {
        result = await rpc('accept_proposal', { p_proposal_id: proposal.id });
      } catch (e) {
        console.error('accept_proposal RPC error:', e);
        // ΔΕΝ καταπίνουμε το σφάλμα: ο πελάτης πρέπει να ξέρει ότι απέτυχε.
        return send(res, 500, {
          error: 'Η αποδοχή δεν ολοκληρώθηκε. Δεν έγινε καμία αλλαγή — δοκιμάστε ξανά ή επικοινωνήστε με τον ανάδοχο.',
        });
      }

      if (!result?.ok) {
        if (result?.error === 'already_answered') {
          return send(res, 409, { error: 'Έχει ήδη δοθεί απάντηση σε αυτή την προσφορά.', status: result.status });
        }
        return send(res, 500, { error: 'Η αποδοχή δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' });
      }

      // Ειδοποίηση στον ανάδοχο (δεν επηρεάζει την αποδοχή αν αποτύχει)
      try {
        const org = toClient(first(await supa.select('organizations', { id: `eq.${proposal.organization_id}` })));
        if (org?.email) {
          await sendEmail({
            to: org.email,
            subject: `Η προσφορά #${proposal.number || ''} έγινε αποδεκτή!`,
            body: `Καλά νέα!\n\nΟ πελάτης ${proposal.client_details?.name || ''} αποδέχτηκε την προσφορά #${proposal.number || ''} (€${proposal.total || 0}).\n\nΤο έργο δημιουργήθηκε αυτόματα στο Jobix.\n\n${APP_URL}/projects`,
          });
        }
      } catch (e) {
        console.error('acceptance notify email failed:', e);
      }

      return send(res, 200, { ok: true, status: 'accepted', projectId: result.project_id });
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
      const publicUrl = `${APP_URL}/proposalpdf?token=${link.token}`;

      const result = await sendEmail({
        to: client.email,
        replyTo: org?.email || undefined,
        subject: `Προσφορά #${proposal.number || ''} από ${org?.name || 'Jobix'}`,
        body: `Αγαπητέ/ή ${client.name || ''},\n\nΣας ευχαριστούμε για το ενδιαφέρον σας. Μπορείτε να δείτε την προσφορά μας και να την αποδεχτείτε ή να την απορρίψετε από τον παρακάτω σύνδεσμο:\n\n${publicUrl}\n\nΜε εκτίμηση,\n${org?.name || 'Jobix'}`,
      });
      return send(res, 200, { emailSent: result.sent === true, publicUrl });
    }

    // Επιστρέφει (ή δημιουργεί) τον δημόσιο σύνδεσμο του έργου.
    // Μόνο ο ιδιοκτήτης μπορεί να τον πάρει — ο σύνδεσμος περιέχει token, όχι το id.
    // ============ JOBIX CARE ============

    // Ενεργοποίηση συμβολαίου: δημιουργεί ΑΤΟΜΙΚΑ όλες τις επισκέψεις.
    if (action === 'activateCareContract') {
      const row = first(await supa.select('care_contracts', { id: `eq.${body.contractId}` }));
      if (!row || !owns(user, row)) return send(res, 404, { error: 'Το συμβόλαιο δεν βρέθηκε.' });

      let result;
      try {
        result = await rpc('activate_care_contract', { p_contract_id: row.id });
      } catch (e) {
        console.error('activate_care_contract RPC error:', e);
        return send(res, 500, { error: 'Η ενεργοποίηση δεν ολοκληρώθηκε. Δεν έγινε καμία αλλαγή.' });
      }
      if (!result?.ok) return send(res, 400, { error: 'Η ενεργοποίηση απέτυχε.', detail: result?.error });
      return send(res, 200, result);
    }

    // Δημόσιος σύνδεσμος αποδοχής συμβολαίου (token, όχι UUID).
    if (action === 'getCareShareLink') {
      const row = first(await supa.select('care_contracts', { id: `eq.${body.contractId}` }));
      if (!row || !owns(user, row)) return send(res, 404, { error: 'Το συμβόλαιο δεν βρέθηκε.' });
      const existing = (await supa.select('care_links', { 'data->>contract_id': `eq.${row.id}` })).map(toClient);
      let link = existing[0];
      if (!link) {
        link = toClient(await supa.insert('care_links', {
          organization_id: row.organization_id,
          created_by: row.created_by || 'system',
          data: { contract_id: row.id, token: crypto.randomUUID() },
        }));
      }
      return send(res, 200, { url: `${APP_URL}/care?token=${link.token}`, token: link.token });
    }

    // Ολοκλήρωση επίσκεψης: μετράει και το υπόλοιπο του συμβολαίου.
    if (action === 'completeCareVisit') {
      const visitRow = first(await supa.select('care_visits', { id: `eq.${body.visitId}` }));
      if (!visitRow || !owns(user, visitRow)) return send(res, 404, { error: 'Η επίσκεψη δεν βρέθηκε.' });
      const v = toClient(visitRow);
      if (v.status === 'completed') return send(res, 409, { error: 'Η επίσκεψη έχει ήδη ολοκληρωθεί.' });

      await supa.update('care_visits', v.id, {
        data: { ...(visitRow.data || {}), status: 'completed', completed_at: now(), notes: body.notes || v.notes || '' },
        updated_date: now(),
      });

      // Αν υπάρχει συνδεδεμένο ραντεβού, κλείσε το κι αυτό — αλλιώς θα έμενε
      // «προγραμματισμένο» στην Ατζέντα για πάντα.
      if (v.appointment_id) {
        const apRow = first(await supa.select('appointments', { id: `eq.${v.appointment_id}` }));
        if (apRow) {
          await supa.update('appointments', apRow.id, {
            data: { ...(apRow.data || {}), status: 'completed' },
            updated_date: now(),
          }).catch((e) => console.error('appointment close failed:', e));
        }
      }

      // Ενημέρωση μετρητή στο συμβόλαιο
      const cRow = first(await supa.select('care_contracts', { id: `eq.${v.contract_id}` }));
      if (cRow) {
        const done = (await supa.select('care_visits', { 'data->>contract_id': `eq.${v.contract_id}` }))
          .map(toClient).filter((x) => x.status === 'completed').length;
        await supa.update('care_contracts', cRow.id, {
          data: { ...(cRow.data || {}), visits_completed: done },
          updated_date: now(),
        });
      }
      return send(res, 200, { ok: true });
    }

    // Προγραμματισμός επίσκεψης: δημιουργεί ΠΡΑΓΜΑΤΙΚΟ ραντεβού στην Ατζέντα
    // και το συνδέει με την επίσκεψη του συμβολαίου.
    if (action === 'scheduleCareVisit') {
      const visitRow = first(await supa.select('care_visits', { id: `eq.${body.visitId}` }));
      if (!visitRow || !owns(user, visitRow)) return send(res, 404, { error: 'Η επίσκεψη δεν βρέθηκε.' });
      const v = toClient(visitRow);
      if (v.status === 'completed') return send(res, 409, { error: 'Η επίσκεψη έχει ήδη ολοκληρωθεί.' });

      const when = String(body.appointment_date || '').trim();
      if (!when || Number.isNaN(new Date(when).getTime())) {
        return send(res, 400, { error: 'Μη έγκυρη ημερομηνία/ώρα.' });
      }

      // Στοιχεία πελάτη για το ραντεβού (ο τεχνίτης θέλει τηλέφωνο & διεύθυνση).
      const client = toClient(first(await supa.select('clients', { id: `eq.${v.client_id}` })));

      // Αν υπάρχει ήδη ραντεβού, ενημέρωσέ το αντί να φτιάξεις δεύτερο.
      if (v.appointment_id) {
        const apRow = first(await supa.select('appointments', { id: `eq.${v.appointment_id}` }));
        if (apRow) {
          await supa.update('appointments', apRow.id, {
            data: { ...(apRow.data || {}), appointment_date: new Date(when).toISOString() },
            updated_date: now(),
          });
          await supa.update('care_visits', v.id, {
            data: { ...(visitRow.data || {}), status: 'scheduled', scheduled_date: new Date(when).toISOString() },
            updated_date: now(),
          });
          return send(res, 200, { ok: true, appointmentId: apRow.id, updated: true });
        }
      }

      // Δημιουργία ραντεβού
      const apRow = await supa.insert('appointments', {
        organization_id: visitRow.organization_id,
        created_by: user.id,
        data: {
          name: `${v.title || 'Επίσκεψη συντήρησης'} — ${client?.name || ''}`.trim(),
          phone: client?.phone || '',
          address: client?.address || '',
          appointment_date: new Date(when).toISOString(),
          notes: `Jobix Care${v.sequence ? ` · επίσκεψη ${v.sequence}` : ''}`,
          status: 'scheduled',
          care_visit_id: v.id,   // σύνδεση πίσω στην επίσκεψη
        },
      });

      // Σύνδεση της επίσκεψης με το ραντεβού. Αν αποτύχει, καθάρισε το ραντεβού
      // ώστε να μη μείνει ορφανό στην Ατζέντα.
      try {
        await supa.update('care_visits', v.id, {
          data: {
            ...(visitRow.data || {}),
            status: 'scheduled',
            appointment_id: apRow.id,
            scheduled_date: new Date(when).toISOString(),
          },
          updated_date: now(),
        });
      } catch (e) {
        console.error('link visit->appointment failed, rolling back:', e);
        await supa.remove('appointments', apRow.id).catch(() => {});
        return send(res, 500, { error: 'Ο προγραμματισμός δεν ολοκληρώθηκε. Δοκιμάστε ξανά.' });
      }

      return send(res, 200, { ok: true, appointmentId: apRow.id, updated: false });
    }

    if (action === 'getProjectShareLink') {
      const projectRow = first(await supa.select('projects', { id: `eq.${body.projectId}` }));
      if (!projectRow || !owns(user, projectRow)) return send(res, 404, { error: 'Το έργο δεν βρέθηκε.' });
      const link = await ensureProjectLink(projectRow.id, projectRow.organization_id, projectRow.created_by);
      return send(res, 200, { url: `${APP_URL}/publicprojectview?token=${link.token}`, token: link.token });
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

    // Βήμα 1: ο browser ζητά signed URL. Βήμα 2: ανεβάζει ΑΠΕΥΘΕΙΑΣ στο Supabase.
    // Έτσι παρακάμπτεται το όριο 4.5MB των Vercel functions.
    if (action === 'upload-url') {
      if (await enforceRateLimit(req, res, { name: 'upload', identifier: user.id, limit: 30, windowSec: 3600 })) return;
      const { name, type, size } = await readJson(req);
      const result = await createSignedUploadUrl({ name, type, size });
      return send(res, 200, result);
    }

    // Προσωρινά URLs ανάγνωσης ιδιωτικών αρχείων. Δέχεται ΕΝΑ path ή ΠΟΛΛΑ
    // (batch), ώστε μια σελίδα με 20 αρχεία να μην κάνει 20 requests.
    if (action === 'file-url') {
      const body2 = await readJson(req);
      const paths = Array.isArray(body2.paths)
        ? body2.paths
        : (body2.path ? [body2.path] : []);
      if (!paths.length) return send(res, 400, { error: 'Λείπει το αρχείο.' });
      if (paths.length > 50) return send(res, 400, { error: 'Πάρα πολλά αρχεία σε ένα αίτημα.' });

      // Φέρε ΜΙΑ φορά όλα τα file records του οργανισμού και έλεγξε δικαιώματα.
      const orgFiles = await supa.select('files', isAdmin(user) ? {} : { organization_id: `eq.${user.organization_id}` });
      const allowed = new Set(orgFiles.map((r) => (r.data || {}).storage_path).filter(Boolean));

      const urls = {};
      for (const p of paths) {
        if (!allowed.has(p)) continue;  // σιωπηλά αγνοούμε ό,τι δεν του ανήκει
        const u = await createSignedDownloadUrl(p);
        if (u) urls[p] = u;
      }
      return send(res, 200, { urls });
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

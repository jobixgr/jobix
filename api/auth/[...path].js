// /api/auth/*  — register, login, me (GET/PATCH), logout, users
import {
  supa, signToken, hashPassword, verifyPassword, getUserFromReq,
  publicUser, isAdmin, send, readJson, applyCors, now,
  enforceRateLimit, clientIp,
} from '../_lib/core.js';

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const segments = req.query.path || [];
  const action = segments[0];

  try {
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

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('auth error:', e);
    return send(res, e.status || 500, { error: e.message || 'Σφάλμα server.' });
  }
}

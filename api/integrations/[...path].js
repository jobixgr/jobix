// /api/integrations/*  — upload (Supabase Storage) + invoke-llm (AI)
import {
  getUserFromReq, invokeLLM, send, readJson, applyCors,
  enforceRateLimit, clientIp,
} from '../_lib/core.js';
import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const BUCKET = process.env.SUPABASE_BUCKET || 'jobix-uploads';

// Ανεβάζει base64 αρχείο στο Supabase Storage και επιστρέφει δημόσιο URL.
async function uploadToStorage({ name, type, data }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const err = new Error('Λείπουν οι μεταβλητές Supabase.');
    err.status = 501;
    throw err;
  }
  const buf = Buffer.from(data, 'base64');
  if (buf.length > 20 * 1024 * 1024) {
    const err = new Error('Το αρχείο ξεπερνά τα 20MB.');
    err.status = 413;
    throw err;
  }
  const ext = (name.match(/\.[a-zA-Z0-9]{1,10}$/) || [''])[0];
  const objectPath = `${new Date().getFullYear()}/${crypto.randomUUID()}${ext}`;

  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
        'Content-Type': type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: buf,
    }
  );
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('Storage upload error:', resp.status, detail);
    const err = new Error('Αποτυχία αποθήκευσης αρχείου.');
    err.status = 502;
    throw err;
  }
  const file_url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  return { file_url, name, type, size: buf.length };
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });

  const action = (req.query.path || [])[0];
  const user = await getUserFromReq(req);
  if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });

  try {
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
  } catch (e) {
    console.error('integrations error:', e);
    return send(res, e.status || 500, { error: e.message || 'Σφάλμα server.' });
  }
}

// /api/entities/*  — CRUD για όλα τα entities, με έλεγχο multi-tenancy server-side.
// Καλύπτει:
//   POST   /api/entities/:name/query    { where, sort, limit }
//   GET    /api/entities/:name/:id
//   POST   /api/entities/:name          (create)
//   POST   /api/entities/:name/bulk     { items }
//   PATCH  /api/entities/:name/:id
//   DELETE /api/entities/:name/:id

import {
  ENTITY_MAP, supa, toClient, toData, getUserFromReq, publicUser,
  isAdmin, send, readJson, applyCors, now,
} from '../_lib/core.js';

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const segments = (req.query.path || []); // π.χ. ['Client','query'] ή ['Client', '<id>']
  const name = segments[0];
  const tail = segments[1]; // 'query' | 'bulk' | <id> | undefined

  const table = ENTITY_MAP[name];
  if (!table) return send(res, 404, { error: `Άγνωστο entity: ${name}` });

  const user = await getUserFromReq(req);
  if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });

  const admin = isAdmin(user);

  // Βοηθός: όρια οργανισμού σε PostgREST filter
  const orgFilter = () => {
    if (admin) return {};
    if (table === 'organizations') {
      // ο χρήστης βλέπει τον οργανισμό του ή όσους κατέχει
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
      base.organization_id = user.organization_id; // ΠΑΝΤΑ server-side
    }
    return base;
  };

  try {
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
  } catch (e) {
    console.error('entities error:', e);
    return send(res, e.status || 500, { error: e.message || 'Σφάλμα server.' });
  }
}

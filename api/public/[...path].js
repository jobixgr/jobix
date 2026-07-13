// /api/public/*  — δημόσια endpoints χωρίς login (token-based)
//   portal-login, project, proposal, proposal-response
import { supa, toClient, send, readJson, applyCors, now, enforceRateLimit, clientIp } from '../_lib/core.js';
import crypto from 'node:crypto';

const first = (arr) => (arr && arr[0] ? arr[0] : null);

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });

  const action = (req.query.path || [])[0];

  // Προστασία: τα δημόσια endpoints είναι εκτεθειμένα χωρίς login.
  // Όριο ανά IP για να αποτραπεί token-guessing / abuse.
  // portal-login & proposal-response: αυστηρότερα (γράφουν/ελέγχουν tokens).
  const strict = action === 'portal-login' || action === 'proposal-response';
  if (await enforceRateLimit(req, res, {
    name: `public-${action}`,
    identifier: clientIp(req),
    limit: strict ? 20 : 60,
    windowSec: 60,
  })) return;

  const body = await readJson(req);

  try {
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
  } catch (e) {
    console.error('public error:', e);
    return send(res, e.status || 500, { error: e.message || 'Σφάλμα server.' });
  }
}

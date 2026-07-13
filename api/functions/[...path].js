// /api/functions/*  — sendProposalEmail, sendInvoiceEmail, push stubs
import {
  supa, toClient, getUserFromReq, isAdmin, sendEmail,
  send, readJson, applyCors, now,
} from '../_lib/core.js';
import crypto from 'node:crypto';

const first = (arr) => (arr && arr[0] ? arr[0] : null);

// Βρίσκει ή δημιουργεί proposal_link για μια προσφορά
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

// Έλεγχος ότι το record ανήκει στον οργανισμό του χρήστη
function owns(user, row) {
  if (isAdmin(user)) return true;
  return row && row.organization_id === user.organization_id;
}

export default async function handler(req, res) {
  applyCors(res, req);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });

  const action = (req.query.path || [])[0];
  const user = await getUserFromReq(req);
  if (!user) return send(res, 401, { error: 'Απαιτείται σύνδεση.' });
  const body = await readJson(req);

  try {
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
  } catch (e) {
    console.error('functions error:', e);
    return send(res, e.status || 500, { error: e.message || 'Σφάλμα server.' });
  }
}

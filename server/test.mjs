// End-to-end tests για το Jobix backend (τρέχουν με: node server/test.mjs)
const B = 'http://localhost:4000';
let pass = 0, fail = 0;

const ok = (cond, name) => {
  if (cond) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘ FAIL:', name); }
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(B + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

console.log('— Auth & ροή εργασίας —');
const reg = await api('/api/auth/register', { method: 'POST', body: { email: 'kostas@test.gr', password: 'password123', full_name: 'Κώστας' } });
ok(reg.status === 200 && reg.data.token, 'εγγραφή χρήστη Α');
const TA = reg.data.token;

const dup = await api('/api/auth/register', { method: 'POST', body: { email: 'kostas@test.gr', password: 'password123' } });
ok(dup.status === 409, 'διπλό email απορρίπτεται');

const badLogin = await api('/api/auth/login', { method: 'POST', body: { email: 'kostas@test.gr', password: 'wrongpass1' } });
ok(badLogin.status === 401, 'λάθος κωδικός απορρίπτεται');

const org = await api('/api/entities/Organization', { method: 'POST', token: TA, body: { name: 'Τεχνική Α', vat_rate: 24, subscription_status: 'trialing', trial_started_at: new Date().toISOString() } });
ok(org.status === 200 && org.data.id, 'δημιουργία οργανισμού');
const OID = org.data.id;

const me = await api('/api/auth/me', { method: 'PATCH', token: TA, body: { organization_id: OID } });
ok(me.status === 200 && me.data.organization_id === OID, 'σύνδεση χρήστη με οργανισμό');

const orgGet = await api(`/api/entities/Organization/${OID}`, { token: TA });
ok(orgGet.status === 200 && orgGet.data.name === 'Τεχνική Α', 'Organization.get');

const client = await api('/api/entities/Client', { method: 'POST', token: TA, body: { name: 'Μαρία Π.', email: 'maria@x.gr' } });
ok(client.status === 200 && client.data.organization_id === OID, 'Client.create — organization_id σφραγίζεται server-side');
const CID = client.data.id;

const prop = await api('/api/entities/Proposal', { method: 'POST', token: TA, body: { client_id: CID, number: '001', title: 'Ανακαίνιση μπάνιου', status: 'sent' } });
const PID = prop.data.id;
ok(prop.status === 200, 'Proposal.create');

const items = await api('/api/entities/ProposalItem/bulk', { method: 'POST', token: TA, body: { items: [
  { proposal_id: PID, kind: 'labor', description: 'Εργασία', quantity: 2, unit: 'ημέρες', unit_price: 150, vat_rate: 24 },
  { proposal_id: PID, kind: 'material', description: 'Πλακάκια', quantity: 20, unit: 'm²', unit_price: 18, vat_rate: 24 },
] } });
ok(items.status === 200 && items.data.length === 2, 'ProposalItem.bulkCreate');

const q = await api('/api/entities/ProposalItem/query', { method: 'POST', token: TA, body: { where: { proposal_id: PID }, sort: '-created_date' } });
ok(q.status === 200 && q.data.length === 2, 'query με where + sort');

const upd = await api(`/api/entities/Proposal/${PID}`, { method: 'PATCH', token: TA, body: { title: 'Ανακαίνιση μπάνιου v2' } });
ok(upd.status === 200 && upd.data.title === 'Ανακαίνιση μπάνιου v2', 'Proposal.update');

console.log('— Δημόσια ροή προσφοράς —');
const fn = await api('/api/functions/sendProposalEmail', { method: 'POST', token: TA, body: { proposalId: PID, origin: 'http://localhost:5173' } });
ok(fn.status === 200 && fn.data.publicUrl.includes('token='), 'sendProposalEmail → δημόσιος σύνδεσμος');
const token = fn.data.publicUrl.split('token=')[1];

const pub = await api('/api/public/proposal', { method: 'POST', body: { token } });
ok(pub.status === 200 && pub.data.items.length === 2 && pub.data.organization.name === 'Τεχνική Α', 'δημόσια προβολή προσφοράς');
ok(!('email' in (pub.data.client || {})), 'το δημόσιο endpoint δεν διαρρέει email πελάτη');

const resp = await api('/api/public/proposal-response', { method: 'POST', body: { token, response: 'accepted' } });
ok(resp.status === 200 && resp.data.status === 'accepted', 'αποδοχή προσφοράς από πελάτη');

const resp2 = await api('/api/public/proposal-response', { method: 'POST', body: { token, response: 'rejected' } });
ok(resp2.status === 409, 'δεύτερη απάντηση μπλοκάρεται');

console.log('— Client Portal —');
const access = await api('/api/entities/ClientAccess', { method: 'POST', token: TA, body: { client_id: CID, access_token: 'portal-secret-token', is_active: true } });
ok(access.status === 200, 'ClientAccess.create');
const proj = await api('/api/entities/Project', { method: 'POST', token: TA, body: { client_id: CID, name: 'Έργο μπάνιου', status: 'active' } });
const portal = await api('/api/public/portal-login', { method: 'POST', body: { token: 'portal-secret-token' } });
ok(portal.status === 200 && portal.data.client.id === CID && portal.data.projects.length === 1, 'portal login επιστρέφει σωστά δεδομένα');
const portalBad = await api('/api/public/portal-login', { method: 'POST', body: { token: 'wrong' } });
ok(portalBad.status === 404, 'portal με λάθος token απορρίπτεται');

const pubProj = await api('/api/public/project', { method: 'POST', body: { id: proj.data.id } });
ok(pubProj.status === 200 && pubProj.data.project.name === 'Έργο μπάνιου', 'δημόσια προβολή έργου');

console.log('— ΑΣΦΑΛΕΙΑ multi-tenancy —');
const regB = await api('/api/auth/register', { method: 'POST', body: { email: 'eve@test.gr', password: 'password123' } });
const TB = regB.data.token;
const orgB = await api('/api/entities/Organization', { method: 'POST', token: TB, body: { name: 'Εταιρεία Β' } });
await api('/api/auth/me', { method: 'PATCH', token: TB, body: { organization_id: orgB.data.id } });

const leak1 = await api('/api/entities/Client/query', { method: 'POST', token: TB, body: {} });
ok(leak1.status === 200 && leak1.data.length === 0, 'Β δεν βλέπει πελάτες του Α (query χωρίς where)');

const leak2 = await api(`/api/entities/Client/${CID}`, { token: TB });
ok(leak2.status === 404, 'Β δεν διαβάζει συγκεκριμένο πελάτη του Α');

const leak3 = await api(`/api/entities/Proposal/${PID}`, { method: 'PATCH', token: TB, body: { title: 'hacked' } });
ok(leak3.status === 404, 'Β δεν τροποποιεί προσφορά του Α');

const leak4 = await api(`/api/entities/Client/${CID}`, { method: 'DELETE', token: TB });
ok(leak4.status === 404, 'Β δεν διαγράφει πελάτη του Α');

const esc = await api('/api/auth/me', { method: 'PATCH', token: TB, body: { organization_id: OID } });
ok(esc.status === 403, 'Β δεν "μπαίνει" στον οργανισμό του Α');

const orgLeak = await api(`/api/entities/Organization/${OID}`, { token: TB });
ok(orgLeak.status === 404, 'Β δεν διαβάζει τον οργανισμό του Α');

const stamp = await api('/api/entities/Client', { method: 'POST', token: TB, body: { name: 'Fake', organization_id: OID } });
ok(stamp.data.organization_id === orgB.data.id, 'το organization_id στο create ΔΕΝ μπορεί να πλαστογραφηθεί');

const move = await api(`/api/entities/Client/${stamp.data.id}`, { method: 'PATCH', token: TB, body: { organization_id: OID } });
ok(move.data.organization_id === orgB.data.id, 'το organization_id στο update ΔΕΝ μπορεί να αλλάξει');

const noAuth = await api('/api/entities/Client/query', { method: 'POST', body: {} });
ok(noAuth.status === 401, 'χωρίς token → 401');

const adminOnly = await api('/api/auth/users', { token: TB });
ok(adminOnly.status === 403, 'User.list μόνο για super_admin');

console.log('— Uploads & AI —');
const up = await api('/api/integrations/upload', { method: 'POST', token: TA, body: { name: 'test.txt', type: 'text/plain', data: Buffer.from('γεια σου Jobix').toString('base64') } });
ok(up.status === 200 && up.data.file_url.startsWith('/uploads/'), 'upload αρχείου');
const dl = await fetch(B + up.data.file_url);
ok(dl.status === 200 && (await dl.text()) === 'γεια σου Jobix', 'κατέβασμα αρχείου');

const llm = await api('/api/integrations/invoke-llm', { method: 'POST', token: TA, body: { prompt: 'test' } });
ok(llm.status === 501, 'InvokeLLM χωρίς API key → καθαρό μήνυμα σφάλματος');

console.log(`\nΑποτέλεσμα: ${pass} πέρασαν, ${fail} απέτυχαν`);
process.exit(fail ? 1 : 0);

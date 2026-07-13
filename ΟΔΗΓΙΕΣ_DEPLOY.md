# Jobix — Ανέβασμα σε Vercel + Supabase

Ο οδηγός είναι σαν του Tipzy — ίδια λογική (GitHub → Vercel → Supabase env variables).
Ακολούθησε τα βήματα με τη σειρά. Θα χρειαστείς ~20-30 λεπτά.

---

## ΒΗΜΑ 1 — Φτιάξε τη βάση στο Supabase

1. Πήγαινε στο **supabase.com** → New Project (δώσε όνομα `jobix`, βάλε έναν κωδικό βάσης και κράτα τον).
2. Μόλις φτιαχτεί, από το αριστερό μενού → **SQL Editor** → **New query**.
3. Άνοιξε το αρχείο `supabase/schema.sql` (από το project), αντίγραψε **όλο** το περιεχόμενο, κάνε paste στο SQL Editor και πάτα **Run**.
   - Θα φτιαχτούν όλοι οι πίνακες (users, organizations, clients, proposals κ.λπ.).

### 1β — Storage bucket (για ανέβασμα αρχείων/λογότυπο)
1. Αριστερό μενού → **Storage** → **New bucket**.
2. Όνομα: `jobix-uploads`. Τσέκαρε **Public bucket** (ώστε να φαίνονται τα αρχεία στις προσφορές).
3. Create.

### 1γ — Πάρε τα κλειδιά της Supabase
1. Αριστερό μενού → **Project Settings** (γρανάζι) → **API**.
2. Κράτα δύο πράγματα (θα τα βάλεις στο Vercel σε λίγο):
   - **Project URL** → κάτι σαν `https://xxxx.supabase.co`
   - **service_role key** (κάτω από «Project API keys» → πάτα «reveal» στο **service_role**, ΟΧΙ το anon)

> ⚠️ Το `service_role` key είναι ΜΥΣΤΙΚΟ και δίνει πλήρη πρόσβαση. Δεν το βάζεις ΠΟΤΕ στο frontend, μόνο στα env variables του Vercel (server-side). Μην το κοινοποιήσεις πουθενά.

---

## ΒΗΜΑ 2 — Ανέβασε τον κώδικα στο GitHub

1. Φτιάξε ένα νέο repo (π.χ. `jobix`) στο GitHub.
2. Ανέβασε **όλο** τον φάκελο του project (εκτός από `node_modules`, `server/data`, `.env`).
   - Ο φάκελος `api/` περιέχει τα serverless functions.
   - Ο φάκελος `server/` (ο παλιός) μπορεί να μείνει — δεν χρησιμοποιείται στο Vercel, είναι μόνο για τοπική δοκιμή.

---

## ΒΗΜΑ 3 — Σύνδεσε το Vercel

1. Πήγαινε στο **vercel.com** → **Add New… → Project** → διάλεξε το GitHub repo `jobix`.
2. Το Vercel θα εντοπίσει αυτόματα ότι είναι **Vite** project (Framework Preset: Vite). Άφησέ το ως έχει.
3. **ΜΗΝ κάνεις Deploy ακόμα** — πρώτα βάλε τα Environment Variables (επόμενο βήμα).

---

## ΒΗΜΑ 4 — Environment Variables στο Vercel

Στη σελίδα του project (πριν το deploy, ή μετά από **Settings → Environment Variables**),
πρόσθεσε τα παρακάτω. Μπορείς να κάνεις paste όλο το μπλοκ μαζί (**Import .env**):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE=το_service_role_key_σου
SUPABASE_BUCKET=jobix-uploads
JWT_SECRET=βάλε_μια_μεγάλη_τυχαία_συμβολοσειρά_εδώ
RESEND_API_KEY=re_το_κλειδί_σου
EMAIL_FROM=Jobix <offers@jobix.gr>
ANTHROPIC_API_KEY=sk-ant-το_κλειδί_σου
```

Σημειώσεις:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE` → από το Βήμα 1γ.
- `JWT_SECRET` → οτιδήποτε μεγάλο & τυχαίο (π.χ. τρέξε στο terminal: `openssl rand -hex 32`). Αν το αλλάξεις αργότερα, θα αποσυνδεθούν όλοι.
- `RESEND_API_KEY` / `EMAIL_FROM` → τα ίδια που ήδη χρησιμοποιείς τοπικά για το email.
- `ANTHROPIC_API_KEY` → μόνο αν θέλεις το AI. Αν το αφήσεις κενό, το AI απλώς βγάζει μήνυμα «δεν είναι ρυθμισμένο», όλα τα άλλα δουλεύουν.
- Environments: άφησε **Production, Preview, Development** (όλα).

---

## ΒΗΜΑ 5 — Deploy

1. Πάτα **Deploy**. Το Vercel θα τρέξει `vite build` και θα ανεβάσει τα functions.
2. Μόλις γίνει πράσινο, άνοιξε το URL που σου δίνει (π.χ. `jobix-xxx.vercel.app`).
3. Κάνε **Εγγραφή** για να φτιάξεις τον πρώτο λογαριασμό.

### Πρώτος διαχειριστής (super_admin)
Για πρόσβαση στο `/admindashboard`:
1. Supabase → **Table Editor** → πίνακας `app_users` → βρες τον χρήστη σου.
2. Άλλαξε το πεδίο `role` από `user` σε `super_admin` → Save.

---

## ΒΗΜΑ 6 — Το domain (jobix.gr)

Όταν είσαι έτοιμος για το πραγματικό domain:
1. Vercel → project → **Settings → Domains** → Add → `jobix.gr` (και `www.jobix.gr`).
2. Το Vercel θα σου δώσει DNS εγγραφές. Επειδή το domain είναι στο **Papaki**, θα τις βάλεις εκεί (όπως έκανες με τις εγγραφές του Resend).

> Προσοχή: το `offers@jobix.gr` (Resend) και το hosting (Vercel) είναι ανεξάρτητα.
> Οι εγγραφές του Resend (DKIM/SPF) ΜΕΝΟΥΝ. Απλώς προσθέτεις τις εγγραφές του Vercel για το domain.

---

## Τι άλλαξε σε σχέση με την τοπική έκδοση

- **Βάση:** από αρχείο JSON → **Supabase (Postgres)**. Τα δεδομένα πλέον είναι μόνιμα και δεν χάνονται.
- **Backend:** από έναν μόνιμο Node server → **Vercel serverless functions** (φάκελος `api/`).
- **Αρχεία:** από τοπικό δίσκο → **Supabase Storage**.
- **Frontend:** ίδιο (Vite/React) — δεν άλλαξε τίποτα στη λογική.
- **Ασφάλεια multi-tenancy:** ίδια, επιβάλλεται server-side στα functions.

## Τοπική δοκιμή (προαιρετικό)

Η νέα αρχιτεκτονική είναι για Vercel. Αν θες να δοκιμάσεις τοπικά με τα functions,
χρειάζεσαι το Vercel CLI: `npm i -g vercel` και μετά `vercel dev` (θα σου ζητήσει τα env vars).
Ο παλιός τοπικός server (`npm run server:local`) εξακολουθεί να δουλεύει με αρχείο JSON,
αλλά ΔΕΝ μιλάει στη Supabase — είναι μόνο για γρήγορες τοπικές δοκιμές UI.

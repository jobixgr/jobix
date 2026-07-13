# Jobix

SaaS διαχείρισης για τεχνίτες και εργολάβους: προσφορές με AI, έργα, εργασίες (kanban),
τιμολόγια/παραστατικά (εσωτερικά), πληρωμές, έξοδα, ατζέντα, client portal, PWA.

**Πλήρως ανεξάρτητο** — το Base44 έχει αφαιρεθεί. Frontend: React/Vite. Backend: καθαρή
Node.js (>= 18) **χωρίς καμία εξωτερική εξάρτηση**, με αποθήκευση σε JSON αρχείο.

---

## Γρήγορη εκκίνηση (development)

```bash
npm install          # μόνο για το frontend (React, Vite, κ.λπ.)

# Terminal 1 — backend (πόρτα 4000)
npm run server

# Terminal 2 — frontend (πόρτα 5173, με proxy προς το backend)
npm run dev
```

Άνοιξε το http://localhost:5173 και κάνε **Εγγραφή** — ο πρώτος λογαριασμός δημιουργείται
από τη σελίδα /login.

## Production

```bash
npm run build        # χτίζει το frontend στο dist/
npm start            # ο server σερβίρει API + dist/ από μία πόρτα (PORT ή 4000)
```

---

## Μεταβλητές περιβάλλοντος (όλες προαιρετικές)

| Μεταβλητή           | Τι κάνει |
|---------------------|----------|
| `PORT`              | Πόρτα server (default 4000) |
| `JWT_SECRET`        | Μυστικό για τα tokens. Αν λείπει, δημιουργείται αυτόματα στο `server/data/.secret` |
| `ANTHROPIC_API_KEY` | Ενεργοποιεί το AI (δημιουργία προσφορών με AI). Χωρίς αυτό, το AI εμφανίζει καθαρό μήνυμα ότι δεν είναι ρυθμισμένο |
| `ANTHROPIC_MODEL`   | Μοντέλο AI (default: claude-sonnet-4-6) |
| `CORS_ORIGIN`       | Περιορισμός CORS origin (default `*`) |

## Πού αποθηκεύονται τα δεδομένα

- **Βάση:** `server/data/db.json` (JSON — κάνε backup αυτό το αρχείο)
- **Αρχεία χρηστών (uploads):** `server/uploads/`
- **Emails:** χωρίς SMTP, τα μηνύματα γράφονται στο `server/outbox/` ως JSON και η
  εφαρμογή σου δίνει τον δημόσιο σύνδεσμο της προσφοράς για να τον στείλεις εσύ
  (email/Viber/WhatsApp). Αν αργότερα βάλεις SMTP ή υπηρεσία email (π.χ. Resend,
  Postmark), το σημείο επέκτασης είναι η `queueEmail()` στο `server/index.js`.

## Διαχειριστής (super_admin)

Για πρόσβαση στο /admindashboard, άλλαξε χειροκίνητα τον ρόλο του χρήστη σου στο
`server/data/db.json`: `"role": "user"` → `"role": "super_admin"` και κάνε restart.

## Ασφάλεια multi-tenancy

Σε αντίθεση με την αρχική έκδοση (όπου το φιλτράρισμα ανά οργανισμό γινόταν από τον
browser), τώρα **ο server επιβάλλει** ότι:

- κάθε εγγραφή σφραγίζεται με το `organization_id` του συνδεδεμένου χρήστη κατά τη
  δημιουργία (ό,τι κι αν στείλει ο client),
- το `organization_id` δεν αλλάζει ποτέ μέσω update,
- όλα τα queries/reads/writes περιορίζονται στον οργανισμό του χρήστη,
- το Client Portal και οι δημόσιες σελίδες (προσφορά, έργο) περνούν από ειδικά
  endpoints με token που επιστρέφουν μόνο τα απολύτως απαραίτητα δεδομένα.

Τεστ: `npm run server` σε ένα terminal και `node server/test.mjs` σε άλλο
(33 tests: ροή εργασίας, δημόσιες σελίδες, portal, ασφάλεια, uploads).

## Σημαντική σημείωση για τα «Τιμολόγια»

Τα παραστατικά που εκδίδει η εφαρμογή είναι **εσωτερικά έγγραφα / ειδοποιήσεις
πληρωμής** — δεν διαβιβάζονται στο myDATA και **δεν αποτελούν νόμιμα φορολογικά
παραστατικά**. Η εφαρμογή το εμφανίζει πλέον ξεκάθαρα στην προβολή παραστατικού.
Για νόμιμη έκδοση: πιστοποιημένος πάροχος ηλεκτρονικής τιμολόγησης ή το δωρεάν
timologio της ΑΑΔΕ. (Από το 2026 η ηλεκτρονική τιμολόγηση B2B είναι υποχρεωτική
για όλους — η ενσωμάτωση με πάροχο είναι το φυσικό επόμενο βήμα του προϊόντος.)

## Τι άλλαξε σε σχέση με το Base44 export

- `server/` — νέος αυτόνομος backend (auth, entities, δημόσια endpoints, uploads, AI proxy)
- `src/api/*` — ξαναγραμμένα ώστε να μιλούν στο δικό μας API με το ίδιο interface
- `src/pages/index.jsx` — νέος router (το Base44 δεν τον συμπεριλάμβανε στο export)
- `src/pages/Login.jsx` — νέα σελίδα σύνδεσης/εγγραφής
- `src/pages/ProposalPDF.jsx` — νέα δημόσια σελίδα προσφοράς με Αποδοχή/Απόρριψη
  (οι σύνδεσμοι της εφαρμογής έδειχναν εκεί, αλλά η σελίδα έλειπε)
- `src/pages/Home.jsx` — η landing (πρώην index.jsx) με νέα ροή σύνδεσης
- Client Portal & δημόσια προβολή έργου: ασφαλή server-side endpoints
- Διορθώσεις: σήμανση myDATA, branding «Contractors Hub»→Jobix, τοπικό logo,
  δυναμική χρονιά στο AI prompt, `createPageUrl` με id, export `ProjectItem` που έλειπε
- Stripe/συνδρομές: παραμένει ανενεργό όπως ήταν (επόμενο βήμα)

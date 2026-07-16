-- ============================================================
-- Jobix — Supabase (Postgres) schema
-- Τρέξε το ΟΛΟΚΛΗΡΟ στο Supabase → SQL Editor → New query → Run.
-- ============================================================

-- Χρειάζεται για gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------- USERS (auth) ----------
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,           -- scrypt hash (salt:hash)
  full_name text default '',
  phone text default '',
  position text default '',
  role text default 'user',         -- 'user' | 'super_admin'
  organization_id uuid,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- ---------- Γενικός βοηθός: κάθε entity = σταθερά πεδία + data JSONB ----------
-- Το data κρατάει όλα τα δυναμικά πεδία του κάθε record (ό,τι έστελνε το frontend).

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  created_by text,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

-- Μακροεντολή-στυλ: όλοι οι org-scoped πίνακες έχουν ίδια δομή.
do $$
declare t text;
begin
  foreach t in array array[
    'clients','proposals','proposal_items','projects','project_items',
    'tasks','payments','invoices','invoice_items','files',
    'item_templates','template_groups','proposal_links','appointments',
    'expenses','client_access'
  ]
  loop
    execute format($f$
      create table if not exists %I (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid,
        created_by text,
        data jsonb not null default '{}'::jsonb,
        created_date timestamptz default now(),
        updated_date timestamptz default now()
      );
      create index if not exists %I on %I (organization_id);
    $f$, t, 'idx_' || t || '_org', t);
  end loop;
end $$;

-- Index για γρήγορη αναζήτηση χρήστη με email
create index if not exists idx_app_users_email on app_users (email);
create index if not exists idx_app_users_org on app_users (organization_id);

-- Index για proposal_links.token (δημόσια αναζήτηση)
create index if not exists idx_proposal_links_token on proposal_links ((data->>'token'));
create index if not exists idx_client_access_token on client_access ((data->>'access_token'));

-- ============================================================
-- Σημείωση ασφαλείας:
-- Δεν χρησιμοποιούμε Row Level Security εδώ γιατί ο έλεγχος
-- πρόσβασης (multi-tenancy) γίνεται στον server (serverless functions)
-- με το service_role key. Το frontend ΔΕΝ μιλάει ποτέ απευθείας
-- στη Supabase — μόνο μέσω των /api functions.
-- Γι' αυτό ο πίνακας πρέπει να ΜΗΝ είναι προσβάσιμος με anon key.
-- ============================================================

-- ============================================================
-- Rate limiting (Ενότητα 2)
-- Κρατάει μετρητές ανά "κλειδί" (π.χ. login:<ip>) σε παράθυρο χρόνου.
-- ============================================================
create table if not exists rate_limits (
  id bigint generated always as identity primary key,
  bucket_key text not null,          -- π.χ. 'login:1.2.3.4' ή 'ai:<userId>'
  window_start timestamptz not null default now(),
  count integer not null default 0,
  unique (bucket_key, window_start)
);
create index if not exists idx_rate_limits_key on rate_limits (bucket_key, window_start);

-- Ατομική αύξηση μετρητή για ένα bucket + παράθυρο (αποφεύγει race conditions).
-- Επιστρέφει το νέο count. Το frontend/functions συγκρίνουν με το όριο.
create or replace function rl_hit(p_key text, p_window_start timestamptz)
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into rate_limits (bucket_key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- Καθάρισμα παλιών εγγραφών (τρέξε περιοδικά ή αγνόησέ το — δεν πειράζει να μαζεύονται).
-- delete from rate_limits where window_start < now() - interval '1 day';

-- ============================================================
-- Password reset + Email verification (account management)
-- Τρέξε ΚΑΙ αυτό στο Supabase SQL Editor (πάνω από ό,τι ήδη έτρεξες).
-- Έχει "if not exists", οπότε δεν χαλάει τίποτα αν ξανατρέξει.
-- ============================================================
alter table app_users add column if not exists reset_token text;
alter table app_users add column if not exists reset_expires timestamptz;
alter table app_users add column if not exists email_verified boolean default false;
alter table app_users add column if not exists verify_token text;

create index if not exists idx_app_users_reset_token on app_users (reset_token);
create index if not exists idx_app_users_verify_token on app_users (verify_token);

-- ============================================================
-- ATOMIC PROPOSAL ACCEPTANCE (launch blocker #4)
-- Τρέξε το στο Supabase SQL Editor.
--
-- ΠΡΟΒΛΗΜΑ που λύνει:
--  (α) Δύο ταυτόχρονα κλικ «Αποδοχή» δημιουργούσαν ΔΥΟ έργα.
--  (β) Αν έσκαγε στη μέση, έμενε έργο χωρίς εργασίες/πληρωμές.
-- ΛΥΣΗ: ένα μοναδικό index + μία function που τρέχει ΟΛΑ σε μία transaction.
--       Είτε ολοκληρώνονται όλα, είτε δεν αλλάζει τίποτα.
-- ============================================================

-- 1) Μοναδικότητα: ΑΔΥΝΑΤΟΝ να υπάρχουν δύο έργα για την ίδια προσφορά.
--    Αυτό είναι η τελική γραμμή άμυνας — ακόμα κι αν ο κώδικας έχει bug.
create unique index if not exists idx_projects_unique_proposal
  on projects ((data->>'proposal_id'))
  where data->>'proposal_id' is not null;

-- 2) Atomic αποδοχή προσφοράς.
create or replace function accept_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_prop      record;
  v_data      jsonb;
  v_org       uuid;
  v_by        text;
  v_project   uuid;
  v_item      record;
  v_today     text := to_char(now(), 'YYYY-MM-DD');
  v_existing  uuid;
begin
  -- Κλείδωμα της γραμμής: αν έρθει δεύτερο request, περιμένει εδώ.
  select * into v_prop from proposals where id = p_proposal_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_data := coalesce(v_prop.data, '{}'::jsonb);
  v_org  := v_prop.organization_id;
  v_by   := coalesce(v_data->>'created_by', 'system');

  -- Αν έχει ήδη απαντηθεί, μην κάνεις τίποτα (idempotent).
  if v_data->>'status' in ('accepted', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'already_answered',
                              'status', v_data->>'status');
  end if;

  -- Αν υπάρχει ήδη έργο (π.χ. από προηγούμενη μισή προσπάθεια), επίστρεψέ το.
  select id into v_existing from projects
   where data->>'proposal_id' = p_proposal_id::text limit 1;
  if v_existing is not null then
    update proposals
       set data = v_data || jsonb_build_object('status','accepted',
                    'responded_at', now()::text, 'accepted_at', now()::text),
           updated_date = now()
     where id = p_proposal_id;
    return jsonb_build_object('ok', true, 'project_id', v_existing, 'reused', true);
  end if;

  -- (α) Ενημέρωση προσφοράς
  update proposals
     set data = v_data || jsonb_build_object('status','accepted',
                  'responded_at', now()::text, 'accepted_at', now()::text),
         updated_date = now()
   where id = p_proposal_id;

  -- (β) Δημιουργία έργου
  insert into projects (organization_id, created_by, data)
  values (v_org, v_by, jsonb_build_object(
    'client_id',    v_data->>'client_id',
    'proposal_id',  p_proposal_id::text,
    'title',        v_data->>'title',
    'description',  coalesce(v_data->>'description', 'Έργο βάσει προσφοράς'),
    'status',       'active',
    'start_date',   v_today,
    'budget_total', v_data->'total',
    'notes',        'Δημιουργήθηκε αυτόματα από αποδοχή προσφοράς #' || coalesce(v_data->>'number','')
  ))
  returning id into v_project;

  -- (γ) Εργασίες από τις γραμμές της προσφοράς
  for v_item in
    select data as d from proposal_items
     where data->>'proposal_id' = p_proposal_id::text
  loop
    insert into tasks (organization_id, created_by, data)
    values (v_org, v_by, jsonb_build_object(
      'project_id',  v_project::text,
      'title',       v_item.d->>'description',
      'description', case when v_item.d->>'type' = 'labor' then '🔧 Εργασία' else '📦 Υλικό' end
                     || ' - Ποσότητα: ' || coalesce(v_item.d->>'quantity','1')
                     || ' ' || coalesce(v_item.d->>'unit','τεμ.')
                     || ', Τιμή: €' || coalesce(v_item.d->>'unit_price','0'),
      'status',      'todo',
      'priority',    'medium'
    ));
  end loop;

  -- (δ) Προκαταβολή, αν υπάρχει
  if (v_data->>'has_advance')::boolean is true
     and coalesce((v_data->>'advance_amount')::numeric, 0) > 0 then
    insert into payments (organization_id, created_by, data)
    values (v_org, v_by, jsonb_build_object(
      'project_id', v_project::text,
      'client_id',  v_data->>'client_id',
      'title',      'Προκαταβολή για ' || coalesce(v_data->>'title',''),
      'amount',     v_data->'advance_amount',
      'currency',   coalesce(v_data->>'currency','EUR'),
      'due_date',   coalesce(v_data->>'advance_received_at', v_today),
      'status',     'paid',
      'paid_at',    coalesce(v_data->>'advance_received_at', now()::text),
      'method',     'bank_transfer',
      'notes',      'Προκαταβολή από προσφορά #' || coalesce(v_data->>'number','')
    ));
  end if;

  return jsonb_build_object('ok', true, 'project_id', v_project, 'reused', false);
end;
$$;

-- ============================================================
-- PUBLIC PROJECT TOKEN (launch blocker #6)
-- Τρέξε το στο Supabase SQL Editor.
--
-- ΠΡΟΒΛΗΜΑ που λύνει: το δημόσιο link έργου ήταν /publicprojectview/<UUID>.
-- Όποιος αποκτούσε το UUID (από logs, screenshot, ιστορικό browser) έβλεπε
-- έργο, εργασίες, ΠΛΗΡΩΜΕΣ και ΑΡΧΕΙΑ — χωρίς καμία αυθεντικοποίηση.
-- ΛΥΣΗ: τυχαίο token ανά έργο (όπως ήδη κάνουν οι προσφορές). Το token
-- μπορεί να ανακληθεί/αλλάξει χωρίς να αλλάξει το ίδιο το έργο.
-- ============================================================
create table if not exists project_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  created_by text,
  data jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists idx_project_links_token
  on project_links ((data->>'token'));
create unique index if not exists idx_project_links_unique_project
  on project_links ((data->>'project_id'));

-- ============================================================
-- PRIVATE STORAGE (launch blocker #5)
-- Τρέξε το στο Supabase SQL Editor.
--
-- ΠΡΟΒΛΗΜΑ που λύνει: το bucket ήταν PUBLIC — όποιος αποκτούσε το URL ενός
-- αρχείου (φωτογραφία έργου, τιμολόγιο, έγγραφο πελάτη) το κατέβαζε ελεύθερα.
-- ΛΥΣΗ: private bucket. Η πρόσβαση γίνεται μόνο με προσωρινά signed URLs
-- που εκδίδει ο server μετά από έλεγχο δικαιωμάτων.
-- ============================================================
update storage.buckets set public = false where id = 'jobix-uploads';

-- Αν το bucket δεν υπάρχει ακόμα, δημιούργησέ το ως private:
insert into storage.buckets (id, name, public)
values ('jobix-uploads', 'jobix-uploads', false)
on conflict (id) do update set public = false;

-- ============================================================
-- JOBIX CARE — Συμβόλαια συντήρησης (Φάση 1)
-- Τρέξε το στο Supabase SQL Editor.
--
-- ΤΙ ΛΥΝΕΙ: δίνει στον τεχνίτη επαναλαμβανόμενο έσοδο από υπάρχοντες πελάτες.
--   care_plans     → τα πακέτα που πουλάει (ορίζονται ΜΙΑ φορά, ξαναχρησιμοποιούνται)
--   care_contracts → πακέτο ανατεθειμένο σε συγκεκριμένο πελάτη
--   care_visits    → κάθε προγραμματισμένη επίσκεψη του συμβολαίου
--   care_links     → δημόσιο link αποδοχής (token, όχι UUID)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['care_plans','care_contracts','care_visits','care_links']
  loop
    execute format($f$
      create table if not exists %I (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid,
        created_by text,
        data jsonb not null default '{}'::jsonb,
        created_date timestamptz default now(),
        updated_date timestamptz default now()
      );
      create index if not exists %I on %I (organization_id);
    $f$, t, 'idx_' || t || '_org', t);
  end loop;
end $$;

-- Indexes για τα φίλτρα που χρησιμοποιούνται συχνά
create index if not exists idx_care_contracts_client
  on care_contracts ((data->>'client_id'));
create index if not exists idx_care_contracts_status
  on care_contracts ((data->>'status'));
create index if not exists idx_care_contracts_end_date
  on care_contracts ((data->>'end_date'));
create index if not exists idx_care_visits_contract
  on care_visits ((data->>'contract_id'));
create index if not exists idx_care_visits_due
  on care_visits ((data->>'due_date'));
create index if not exists idx_care_visits_status
  on care_visits ((data->>'status'));
create index if not exists idx_care_links_token
  on care_links ((data->>'token'));

-- Ένα ενεργό link ανά συμβόλαιο
create unique index if not exists idx_care_links_unique_contract
  on care_links ((data->>'contract_id'));

-- ------------------------------------------------------------
-- Ενεργοποίηση συμβολαίου: δημιουργεί ΑΤΟΜΙΚΑ όλες τις επισκέψεις.
-- Είτε δημιουργούνται όλες, είτε καμία (όπως το accept_proposal).
-- Idempotent: αν ξανακληθεί, δεν διπλασιάζει τίποτα.
-- ------------------------------------------------------------
create or replace function activate_care_contract(p_contract_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_c          record;
  v_data       jsonb;
  v_visits     int;
  v_months     int;
  v_start      date;
  v_interval   numeric;
  v_i          int;
  v_due        date;
  v_existing   int;
  v_created    int := 0;
begin
  select * into v_c from care_contracts where id = p_contract_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_data   := coalesce(v_c.data, '{}'::jsonb);
  v_visits := greatest(coalesce((v_data->>'visits_total')::int, 1), 1);
  v_months := greatest(coalesce((v_data->>'duration_months')::int, 12), 1);
  v_start  := coalesce((v_data->>'start_date')::date, current_date);

  -- Αν έχει ήδη επισκέψεις, μην ξαναδημιουργήσεις (idempotent).
  select count(*) into v_existing from care_visits
   where data->>'contract_id' = p_contract_id::text;
  if v_existing > 0 then
    update care_contracts
       set data = v_data || jsonb_build_object('status','active'),
           updated_date = now()
     where id = p_contract_id;
    return jsonb_build_object('ok', true, 'visits_created', 0, 'reused', true);
  end if;

  -- Κατανομή επισκέψεων στη διάρκεια:
  -- 12 μήνες / 2 επισκέψεις → μήνας 0 και 6.  12/4 → 0, 3, 6, 9.
  v_interval := v_months::numeric / v_visits::numeric;

  for v_i in 1..v_visits loop
    v_due := v_start + ((v_i - 1) * v_interval * 30.44)::int;  -- ~μήνας
    insert into care_visits (organization_id, created_by, data)
    values (v_c.organization_id, v_c.created_by, jsonb_build_object(
      'contract_id', p_contract_id::text,
      'client_id',   v_data->>'client_id',
      'sequence',    v_i,
      'due_date',    to_char(v_due, 'YYYY-MM-DD'),
      'status',      'pending',
      'title',       coalesce(v_data->>'plan_name', 'Επίσκεψη συντήρησης')
                     || ' (' || v_i || '/' || v_visits || ')'
    ));
    v_created := v_created + 1;
  end loop;

  update care_contracts
     set data = v_data || jsonb_build_object(
           'status', 'active',
           'activated_at', now()::text,
           'end_date', to_char(v_start + (v_months * 30.44)::int, 'YYYY-MM-DD')
         ),
         updated_date = now()
   where id = p_contract_id;

  return jsonb_build_object('ok', true, 'visits_created', v_created, 'reused', false);
end;
$$;

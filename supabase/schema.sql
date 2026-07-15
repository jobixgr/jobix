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

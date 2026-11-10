-- ACME Bank — core schema
-- All monetary values are stored as integer cents (bigint).

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'support', 'admin');
create type public.account_type as enum ('checking', 'savings');
create type public.account_status as enum ('active', 'frozen', 'closed');
create type public.txn_status as enum ('pending', 'posted', 'failed', 'cancelled');
create type public.txn_kind as enum (
  'opening_deposit', 'deposit', 'payroll', 'transfer', 'bill_payment',
  'card_purchase', 'fee', 'interest', 'refund', 'withdrawal'
);
create type public.entry_direction as enum ('debit', 'credit');
create type public.transfer_rail as enum ('internal', 'ach', 'instant', 'wire');
create type public.card_status as enum ('active', 'locked', 'cancelled');
create type public.schedule_frequency as enum ('once', 'weekly', 'biweekly', 'monthly');
create type public.schedule_status as enum ('active', 'paused', 'completed', 'cancelled');
create type public.ticket_status as enum ('open', 'pending_customer', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.application_status as enum ('pending_review', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Simulation clock (single row). sim_now() = anchor_ts + (real time elapsed since anchor_real)
-- ---------------------------------------------------------------------------
create table public.sim_state (
  id int primary key default 1 check (id = 1),
  anchor_ts timestamptz not null default now(),
  anchor_real timestamptz not null default now(),
  scenario text not null default 'baseline',
  flags jsonb not null default '{}'::jsonb,
  auto_activity boolean not null default true,
  last_reset_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.sim_state (id) values (1);

create or replace function public.sim_now()
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.anchor_ts + (clock_timestamp() - s.anchor_real) from public.sim_state s where s.id = 1;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create sequence public.customer_number_seq start 100001;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  date_of_birth date,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  role public.user_role not null default 'customer',
  customer_number text unique,
  kyc_status text not null default 'not_started'
    check (kyc_status in ('not_started', 'pending_review', 'verified', 'rejected')),
  avatar_path text,
  persona text,
  is_demo boolean not null default false,
  preferences jsonb not null default jsonb_build_object(
    'email_alerts', true,
    'push_alerts', true,
    'low_balance_alert_cents', 10000,
    'large_transaction_alert_cents', 50000,
    'marketing_emails', false,
    'theme', 'system'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Fee schedule
-- ---------------------------------------------------------------------------
create table public.fee_schedule (
  code text primary key,
  name text not null,
  description text not null,
  flat_cents bigint not null default 0,
  percent_bps int not null default 0,
  min_cents bigint not null default 0,
  max_cents bigint
);

insert into public.fee_schedule (code, name, description, flat_cents, percent_bps, min_cents, max_cents) values
  ('transfer_internal', 'ACME transfer', 'Transfers between ACME Bank accounts settle instantly and are free.', 0, 0, 0, null),
  ('transfer_ach', 'Standard ACH transfer', 'Free transfer to another bank. Settles in 1–3 business days.', 0, 0, 0, null),
  ('transfer_instant', 'Instant transfer', '1.5% of the amount (min $0.50, max $15.00). Arrives in minutes.', 0, 150, 50, 1500),
  ('transfer_wire', 'Domestic wire', 'Flat $25.00 fee. Settles the next business day.', 2500, 0, 0, null),
  ('bill_payment', 'Bill payment', 'Scheduled and one-time bill payments are free.', 0, 0, 0, null),
  ('card_foreign', 'Foreign transaction fee', '3% of international card purchases.', 0, 300, 0, null),
  ('card_replacement', 'Card replacement', 'Flat $5.00 fee to replace a lost or damaged card.', 500, 0, 0, null),
  ('monthly_maintenance', 'Monthly maintenance', '$12.00 per month, waived with a balance of $1,500 or more.', 1200, 0, 0, null);

-- ---------------------------------------------------------------------------
-- Accounts (customer deposit accounts + bank system/GL accounts)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  is_system boolean not null default false,
  system_code text unique,
  type public.account_type not null default 'checking',
  nickname text not null,
  account_number text not null unique,
  routing_number text not null default '021999001',
  currency text not null default 'USD',
  status public.account_status not null default 'active',
  balance_cents bigint not null default 0,
  pending_debits_cents bigint not null default 0 check (pending_debits_cents >= 0),
  available_cents bigint generated always as (balance_cents - pending_debits_cents) stored,
  daily_transfer_limit_cents bigint not null default 500000,
  interest_rate_bps int not null default 0,
  status_reason text,
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_owner_chk check (is_system or owner_id is not null),
  constraint accounts_balance_chk check (is_system or balance_cents >= 0),
  constraint accounts_limit_chk check (daily_transfer_limit_cents between 0 and 5000000)
);
create index accounts_owner_idx on public.accounts (owner_id);

-- Bank-side accounts used as the contra side of every double-entry posting.
insert into public.accounts (is_system, system_code, type, nickname, account_number) values
  (true, 'EXTERNAL_CLEARING', 'checking', 'External clearing (ACH / wire)', '9000000001'),
  (true, 'CARD_NETWORK', 'checking', 'Card network settlement', '9000000002'),
  (true, 'FEE_INCOME', 'checking', 'Fee income', '9000000003'),
  (true, 'INTEREST_EXPENSE', 'checking', 'Interest expense', '9000000004');

-- ---------------------------------------------------------------------------
-- Beneficiaries (payees)
-- ---------------------------------------------------------------------------
create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  nickname text,
  bank_name text not null default 'ACME Bank',
  account_number text not null check (account_number ~ '^[0-9]{6,17}$'),
  routing_number text not null check (routing_number ~ '^[0-9]{9}$'),
  email text,
  internal_account_id uuid references public.accounts (id) on delete set null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, account_number, routing_number)
);
create index beneficiaries_owner_idx on public.beneficiaries (owner_id);

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  cardholder_name text not null,
  brand text not null default 'Visa',
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  expiry_month int not null check (expiry_month between 1 and 12),
  expiry_year int not null,
  status public.card_status not null default 'active',
  status_reason text,
  daily_limit_cents bigint not null default 150000 check (daily_limit_cents between 0 and 1000000),
  monthly_limit_cents bigint not null default 1000000 check (monthly_limit_cents between 0 and 5000000),
  online_enabled boolean not null default true,
  contactless_enabled boolean not null default true,
  international_enabled boolean not null default false,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index cards_owner_idx on public.cards (owner_id);

-- ---------------------------------------------------------------------------
-- Scheduled payments
-- ---------------------------------------------------------------------------
create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete cascade,
  beneficiary_id uuid references public.beneficiaries (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  frequency public.schedule_frequency not null default 'monthly',
  next_run_date date not null,
  end_date date,
  status public.schedule_status not null default 'active',
  last_run_at timestamptz,
  last_result text,
  run_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint scheduled_target_chk check ((beneficiary_id is not null) <> (to_account_id is not null))
);
create index scheduled_owner_idx on public.scheduled_payments (owner_id);
create index scheduled_due_idx on public.scheduled_payments (status, next_run_date);

-- ---------------------------------------------------------------------------
-- Transactions + double-entry ledger
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('TX' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  kind public.txn_kind not null,
  status public.txn_status not null default 'pending',
  rail public.transfer_rail,
  direction public.entry_direction not null, -- relative to account_id
  description text not null,
  recipient_description text,                -- shown to counterparty_account_id
  counterparty_name text,
  category text not null default 'Other',
  amount_cents bigint not null check (amount_cents > 0),
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  hold_cents bigint not null default 0 check (hold_cents >= 0),
  account_id uuid not null references public.accounts (id) on delete cascade,
  counterparty_account_id uuid references public.accounts (id) on delete set null,
  is_own_transfer boolean not null default false,
  beneficiary_id uuid references public.beneficiaries (id) on delete set null,
  card_id uuid references public.cards (id) on delete set null,
  scheduled_payment_id uuid references public.scheduled_payments (id) on delete set null,
  initiated_by uuid references public.profiles (id) on delete set null,
  requires_review boolean not null default false,
  review_note text,
  failure_reason text,
  settles_at timestamptz,
  posted_at timestamptz,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default public.sim_now()
);
create index transactions_account_idx on public.transactions (account_id, created_at desc);
create index transactions_cp_idx on public.transactions (counterparty_account_id, created_at desc);
create index transactions_status_idx on public.transactions (status, settles_at);
create index transactions_card_idx on public.transactions (card_id, created_at);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  direction public.entry_direction not null,
  amount_cents bigint not null check (amount_cents > 0),
  balance_after_cents bigint not null,
  memo text,
  created_at timestamptz not null
);
create index ledger_account_idx on public.ledger_entries (account_id, created_at, id);
create index ledger_txn_idx on public.ledger_entries (transaction_id);

-- ---------------------------------------------------------------------------
-- Account opening applications
-- ---------------------------------------------------------------------------
create table public.account_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_type public.account_type not null default 'checking',
  status public.application_status not null default 'pending_review',
  full_name text not null,
  date_of_birth date not null,
  phone text not null,
  address_line1 text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  ssn_last4 text not null check (ssn_last4 ~ '^[0-9]{4}$'),
  employment_status text not null,
  annual_income_cents bigint not null default 0,
  initial_deposit_cents bigint not null default 0 check (initial_deposit_cents >= 0),
  risk_score int not null default 0,
  decision_note text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default public.sim_now()
);
create index applications_status_idx on public.account_applications (status);

-- ---------------------------------------------------------------------------
-- Support
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 5001),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (length(trim(subject)) between 3 and 160),
  category text not null default 'general'
    check (category in ('general', 'card', 'transfer', 'account', 'fraud', 'statement', 'technical')),
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'normal',
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default public.sim_now(),
  updated_at timestamptz not null default public.sim_now()
);
create index tickets_customer_idx on public.support_tickets (customer_id);
create index tickets_status_idx on public.support_tickets (status);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 5000),
  is_internal boolean not null default false,
  attachment_path text,
  attachment_name text,
  created_at timestamptz not null default public.sim_now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications + simulation/audit events
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'error')),
  link text,
  read_at timestamptz,
  created_at timestamptz not null default public.sim_now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.sim_events (
  id bigint generated always as identity primary key,
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  message text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  subject_user_id uuid references public.profiles (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  transaction_id uuid references public.transactions (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default public.sim_now(),
  created_at timestamptz not null default now()
);
create index sim_events_occurred_idx on public.sim_events (occurred_at desc);
create index sim_events_type_idx on public.sim_events (type);

-- ---------------------------------------------------------------------------
-- Activity view: one row per transaction per affected customer account
-- ---------------------------------------------------------------------------
create view public.account_activity with (security_invoker = true) as
select
  t.id, t.reference, t.kind, t.status, t.rail, t.category, t.counterparty_name,
  t.account_id, t.direction, t.description, t.amount_cents, t.fee_cents,
  case when t.direction = 'debit' then -(t.amount_cents + t.fee_cents) else t.amount_cents end as signed_amount_cents,
  t.card_id, t.failure_reason, t.requires_review, t.settles_at, t.posted_at, t.created_at
from public.transactions t
union all
select
  t.id, t.reference, t.kind, t.status, t.rail, t.category, t.counterparty_name,
  t.counterparty_account_id, 'credit'::public.entry_direction,
  coalesce(t.recipient_description, t.description), t.amount_cents, 0,
  t.amount_cents, null, t.failure_reason, t.requires_review, t.settles_at, t.posted_at, t.created_at
from public.transactions t
where t.counterparty_account_id is not null and t.status in ('pending', 'posted');

-- ---------------------------------------------------------------------------
-- updated_at helpers
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger accounts_touch before update on public.accounts
  for each row execute function private.touch_updated_at();

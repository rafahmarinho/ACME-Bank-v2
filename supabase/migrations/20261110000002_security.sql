-- ACME Bank — roles, row level security, storage and realtime

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so they can be used inside RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role in ('support', 'admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.owns_account(p_account uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.accounts a where a.id = p_account and a.owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Customers may edit their contact details but never their role, KYC status or demo flags.
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Runs as the invoking role: banking functions (security definer) and the service role pass through.
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.kyc_status is distinct from old.kyc_status
     or new.customer_number is distinct from old.customer_number
     or new.is_demo is distinct from old.is_demo
     or new.persona is distinct from old.persona
     or new.email is distinct from old.email then
    raise exception 'You are not allowed to change these profile fields' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function private.protect_profile_columns();

-- Detect beneficiaries that are ACME customers so transfers settle internally.
create or replace function private.link_internal_beneficiary()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  select a.id into new.internal_account_id
  from public.accounts a
  where a.account_number = new.account_number
    and a.routing_number = new.routing_number
    and not a.is_system
    and a.status <> 'closed'
  limit 1;
  if new.internal_account_id is not null then
    new.bank_name := 'ACME Bank';
  end if;
  return new;
end $$;

create trigger beneficiaries_link before insert or update of account_number, routing_number
  on public.beneficiaries for each row execute function private.link_internal_beneficiary();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.sim_state enable row level security;
alter table public.profiles enable row level security;
alter table public.fee_schedule enable row level security;
alter table public.accounts enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.cards enable row level security;
alter table public.scheduled_payments enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.account_applications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.sim_events enable row level security;

-- sim_state: anyone signed in can read the clock; writes only through functions.
create policy sim_state_read on public.sim_state for select to authenticated using (true);

-- fee schedule is public reference data
create policy fees_read on public.fee_schedule for select to anon, authenticated using (true);

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- accounts (writes only through security definer functions)
create policy accounts_select on public.accounts for select to authenticated
  using ((owner_id = auth.uid() and not is_system) or public.is_staff());

-- beneficiaries
create policy beneficiaries_select on public.beneficiaries for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
create policy beneficiaries_insert on public.beneficiaries for insert to authenticated
  with check (owner_id = auth.uid());
create policy beneficiaries_update on public.beneficiaries for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy beneficiaries_delete on public.beneficiaries for delete to authenticated
  using (owner_id = auth.uid());

-- cards (changes through functions)
create policy cards_select on public.cards for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());

-- scheduled payments
create policy scheduled_select on public.scheduled_payments for select to authenticated
  using (owner_id = auth.uid() or public.is_staff());
create policy scheduled_insert on public.scheduled_payments for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.owns_account(from_account_id)
    and (to_account_id is null or public.owns_account(to_account_id))
    and (beneficiary_id is null or exists (
      select 1 from public.beneficiaries b where b.id = beneficiary_id and b.owner_id = auth.uid()))
  );
create policy scheduled_update on public.scheduled_payments for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.owns_account(from_account_id));
create policy scheduled_delete on public.scheduled_payments for delete to authenticated
  using (owner_id = auth.uid());

-- transactions + ledger (read-only to clients)
create policy transactions_select on public.transactions for select to authenticated
  using (
    public.owns_account(account_id)
    or (counterparty_account_id is not null and public.owns_account(counterparty_account_id))
    or public.is_staff()
  );
create policy ledger_select on public.ledger_entries for select to authenticated
  using (public.owns_account(account_id) or public.is_staff());

-- applications
create policy applications_select on public.account_applications for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- support tickets
create policy tickets_select on public.support_tickets for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (customer_id = auth.uid());
create policy tickets_update_staff on public.support_tickets for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy tickets_update_owner on public.support_tickets for update to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid() and status in ('closed', 'open'));

create policy messages_select on public.ticket_messages for select to authenticated
  using (
    public.is_staff()
    or (not is_internal and exists (
      select 1 from public.support_tickets t where t.id = ticket_id and t.customer_id = auth.uid()))
  );
create policy messages_insert on public.ticket_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_staff()
      or (not is_internal and exists (
        select 1 from public.support_tickets t where t.id = ticket_id and t.customer_id = auth.uid()))
    )
  );

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- events: staff only
create policy events_select on public.sim_events for select to authenticated
  using (public.is_staff());

-- Ticket message side effects: keep ticket status/updated_at in sync and notify the customer.
create or replace function private.on_ticket_message()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ticket public.support_tickets;
  v_staff boolean;
begin
  select * into v_ticket from public.support_tickets where id = new.ticket_id;
  select role in ('support', 'admin') into v_staff from public.profiles where id = new.author_id;
  if new.is_internal then
    update public.support_tickets set updated_at = public.sim_now() where id = new.ticket_id;
    return new;
  end if;
  if coalesce(v_staff, false) then
    update public.support_tickets
      set status = case when status in ('resolved', 'closed') then status else 'pending_customer' end,
          assigned_to = coalesce(assigned_to, new.author_id),
          updated_at = public.sim_now()
      where id = new.ticket_id;
    insert into public.notifications (user_id, title, body, kind, link)
    values (v_ticket.customer_id, 'New reply from ACME Support',
            'Ticket #' || v_ticket.number || ': ' || v_ticket.subject, 'info', '/support/' || v_ticket.id);
  else
    update public.support_tickets set status = 'open', updated_at = public.sim_now() where id = new.ticket_id;
  end if;
  return new;
end $$;

create trigger ticket_messages_after_insert after insert on public.ticket_messages
  for each row execute function private.on_ticket_message();

-- ---------------------------------------------------------------------------
-- Storage: avatars (public read) and support attachments (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('support-attachments', 'support-attachments', false, 5242880,
   array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'])
on conflict (id) do nothing;

create policy "avatars are publicly readable" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "users upload their own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ticket participants read attachments" on storage.objects for select to authenticated
  using (
    bucket_id = 'support-attachments' and (
      public.is_staff() or exists (
        select 1 from public.support_tickets t
        where t.id::text = (storage.foldername(name))[1] and t.customer_id = auth.uid()))
  );
create policy "ticket participants upload attachments" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'support-attachments' and (
      public.is_staff() or exists (
        select 1 from public.support_tickets t
        where t.id::text = (storage.foldername(name))[1] and t.customer_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.notifications, public.accounts, public.transactions, public.sim_state,
  public.sim_events, public.support_tickets, public.ticket_messages;

-- ---------------------------------------------------------------------------
-- Grants: the private schema is never exposed through the API.
-- ---------------------------------------------------------------------------
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

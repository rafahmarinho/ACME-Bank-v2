-- ACME Bank — banking engine (double-entry posting, transfers, cards, deposits, schedules)
-- Internal helpers live in the `private` schema (not exposed through the API).
-- Public RPCs validate the caller with auth.uid() and then delegate to private helpers.

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------
create or replace function private.money(p_cents bigint)
returns text language sql immutable as $$
  select (case when p_cents < 0 then '-$' else '$' end) || to_char(abs(p_cents) / 100.0, 'FM999,999,999,990.00');
$$;

create or replace function private.local_date(p_ts timestamptz)
returns date language sql stable as $$
  select (p_ts at time zone 'America/New_York')::date;
$$;

create or replace function private.system_account(p_code text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.accounts where system_code = p_code;
$$;

create or replace function private.set_clock(p_ts timestamptz)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.sim_state set anchor_ts = p_ts, anchor_real = clock_timestamp(), updated_at = now() where id = 1;
$$;

create or replace function private.fee(p_code text, p_amount bigint)
returns bigint language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  f public.fee_schedule;
  v bigint;
begin
  select * into f from public.fee_schedule where code = p_code;
  if not found then return 0; end if;
  v := f.flat_cents + round(coalesce(p_amount, 0) * f.percent_bps / 10000.0)::bigint;
  if v > 0 then v := greatest(v, f.min_cents); end if;
  if f.max_cents is not null then v := least(v, f.max_cents); end if;
  return v;
end $$;

create or replace function private.notify(p_user uuid, p_title text, p_body text, p_kind text default 'info', p_link text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (user_id, title, body, kind, link)
  select p_user, p_title, p_body, p_kind, p_link where p_user is not null;
$$;

create or replace function private.log_event(
  p_type text, p_severity text, p_message text,
  p_subject uuid default null, p_account uuid default null, p_txn uuid default null,
  p_payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.sim_events (type, severity, message, actor_id, subject_user_id, account_id, transaction_id, payload)
  values (p_type, p_severity, p_message, auth.uid(), p_subject, p_account, p_txn, coalesce(p_payload, '{}'::jsonb));
$$;

create or replace function private.new_account_number()
returns text language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v text;
begin
  loop
    v := '40' || lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.accounts where account_number = v);
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Ledger posting
-- ---------------------------------------------------------------------------
create or replace function private.add_entry(
  p_txn uuid, p_account uuid, p_dir public.entry_direction, p_amount bigint, p_memo text, p_ts timestamptz)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_bal bigint;
begin
  if coalesce(p_amount, 0) <= 0 then return null; end if;
  update public.accounts
     set balance_cents = balance_cents + case when p_dir = 'credit' then p_amount else -p_amount end
   where id = p_account
   returning balance_cents into v_bal;
  insert into public.ledger_entries (transaction_id, account_id, direction, amount_cents, balance_after_cents, memo, created_at)
  values (p_txn, p_account, p_dir, p_amount, v_bal, p_memo, p_ts);
  return v_bal;
end $$;

-- Posts a pending transaction: writes balanced debit/credit entries, releases holds.
create or replace function private.post_txn(p_txn uuid)
returns public.txn_status language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t public.transactions;
  a public.accounts;
  v_now timestamptz := public.sim_now();
  v_contra uuid;
  v_owner uuid;
  v_prefs jsonb;
  v_bal bigint;
begin
  select * into t from public.transactions where id = p_txn for update;
  if not found or t.status <> 'pending' then
    return t.status;
  end if;

  select * into a from public.accounts where id = t.account_id for update;

  if t.direction = 'debit' then
    -- Funds were reserved by the hold; make sure they are still there.
    if a.balance_cents - (a.pending_debits_cents - t.hold_cents) < t.amount_cents + t.fee_cents then
      update public.accounts set pending_debits_cents = pending_debits_cents - t.hold_cents where id = a.id;
      update public.transactions
         set status = 'failed', hold_cents = 0, failure_reason = 'Insufficient funds at settlement'
       where id = t.id;
      return 'failed';
    end if;
    update public.accounts set pending_debits_cents = pending_debits_cents - t.hold_cents where id = a.id;
  end if;

  v_contra := case
    when t.counterparty_account_id is not null then t.counterparty_account_id
    when t.kind = 'card_purchase' then private.system_account('CARD_NETWORK')
    when t.kind = 'interest' then private.system_account('INTEREST_EXPENSE')
    when t.kind = 'fee' then private.system_account('FEE_INCOME')
    else private.system_account('EXTERNAL_CLEARING')
  end;

  if t.direction = 'debit' then
    v_bal := private.add_entry(t.id, t.account_id, 'debit', t.amount_cents, t.description, v_now);
    perform private.add_entry(t.id, v_contra, 'credit', t.amount_cents,
      coalesce(t.recipient_description, t.description), v_now);
    if t.fee_cents > 0 then
      v_bal := private.add_entry(t.id, t.account_id, 'debit', t.fee_cents, 'Fee — ' || t.description, v_now);
      perform private.add_entry(t.id, private.system_account('FEE_INCOME'), 'credit', t.fee_cents,
        'Fee — ' || t.reference, v_now);
    end if;
  else
    perform private.add_entry(t.id, t.account_id, 'credit', t.amount_cents, t.description, v_now);
    perform private.add_entry(t.id, v_contra, 'debit', t.amount_cents, t.description, v_now);
  end if;

  update public.transactions set status = 'posted', posted_at = v_now, hold_cents = 0 where id = t.id;

  -- Low balance alert for customer accounts
  if t.direction = 'debit' and not a.is_system then
    select p.id, p.preferences into v_owner, v_prefs from public.profiles p where p.id = a.owner_id;
    if v_bal is not null and v_bal < coalesce((v_prefs ->> 'low_balance_alert_cents')::bigint, 10000) then
      perform private.notify(v_owner, 'Low balance alert',
        a.nickname || ' balance is now ' || private.money(v_bal) || '.', 'warning', '/accounts/' || a.id);
    end if;
  end if;

  if t.counterparty_account_id is not null then
    select owner_id into v_owner from public.accounts where id = t.counterparty_account_id;
    if v_owner is not null and not t.is_own_transfer then
      perform private.notify(v_owner, 'Money received',
        private.money(t.amount_cents) || ' — ' || coalesce(t.recipient_description, t.description), 'success',
        '/accounts/' || t.counterparty_account_id);
    end if;
  end if;

  return 'posted';
end $$;

-- Cancels a pending transaction and releases the hold.
create or replace function private.release_txn(p_txn uuid, p_status public.txn_status, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.transactions;
begin
  select * into t from public.transactions where id = p_txn for update;
  if not found or t.status <> 'pending' then return; end if;
  if t.hold_cents > 0 then
    update public.accounts set pending_debits_cents = pending_debits_cents - t.hold_cents where id = t.account_id;
  end if;
  update public.transactions set status = p_status, hold_cents = 0, failure_reason = p_reason where id = t.id;
end $$;

-- Sum of outgoing transfers today (sim date) that count toward the daily limit.
create or replace function private.outgoing_today(p_account uuid)
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(amount_cents), 0)::bigint
  from public.transactions
  where account_id = p_account
    and direction = 'debit'
    and kind in ('transfer', 'bill_payment')
    and not is_own_transfer
    and status in ('pending', 'posted')
    and private.local_date(created_at) = private.local_date(public.sim_now());
$$;

create or replace function private.rail_fee(p_rail public.transfer_rail, p_amount bigint)
returns bigint language sql stable as $$
  select private.fee(case p_rail
    when 'internal' then 'transfer_internal'
    when 'ach' then 'transfer_ach'
    when 'instant' then 'transfer_instant'
    when 'wire' then 'transfer_wire' end, p_amount);
$$;

-- ---------------------------------------------------------------------------
-- Transfers
-- ---------------------------------------------------------------------------
create or replace function private.do_transfer(
  p_actor uuid,
  p_from uuid,
  p_amount bigint,
  p_rail public.transfer_rail default 'ach',
  p_to_account uuid default null,
  p_beneficiary uuid default null,
  p_memo text default null,
  p_key text default null,
  p_kind public.txn_kind default 'transfer',
  p_scheduled uuid default null,
  p_enforce_limit boolean default true,
  p_category text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.accounts;
  d public.accounts;
  b public.beneficiaries;
  v_existing public.transactions;
  v_rail public.transfer_rail;
  v_fee bigint;
  v_now timestamptz := public.sim_now();
  v_settle timestamptz;
  v_review boolean := false;
  v_own boolean := false;
  v_immediate boolean;
  v_used bigint;
  v_cp_name text;
  v_sender text;
  v_desc text;
  v_txn uuid;
  v_status public.txn_status;
  v_flags jsonb;
begin
  if p_key is not null then
    select * into v_existing from public.transactions where idempotency_key = p_key;
    if found then
      return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference,
        'status', v_existing.status, 'fee_cents', v_existing.fee_cents,
        'failure_reason', v_existing.failure_reason, 'duplicate', true);
    end if;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than $0.00' using errcode = '22023';
  end if;
  if p_amount > 10000000 then
    raise exception 'Transfers are limited to $100,000.00 per transaction' using errcode = '22023';
  end if;

  select * into a from public.accounts where id = p_from for update;
  if not found or a.is_system then
    raise exception 'Source account not found' using errcode = 'P0002';
  end if;
  if a.status <> 'active' then
    raise exception 'Your % account is % and cannot send money', a.nickname, a.status using errcode = '22023';
  end if;

  select full_name into v_sender from public.profiles where id = a.owner_id;

  if p_beneficiary is not null then
    select * into b from public.beneficiaries where id = p_beneficiary and owner_id = a.owner_id;
    if not found then
      raise exception 'Beneficiary not found' using errcode = 'P0002';
    end if;
    v_cp_name := b.name;
    if b.internal_account_id is not null then
      p_to_account := b.internal_account_id;
    end if;
  end if;

  if p_to_account is not null then
    select * into d from public.accounts where id = p_to_account for update;
    if not found or d.is_system then
      raise exception 'Destination account not found' using errcode = 'P0002';
    end if;
    if d.id = a.id then
      raise exception 'Choose a destination different from the source account' using errcode = '22023';
    end if;
    if d.status = 'closed' then
      raise exception 'The destination account is closed' using errcode = '22023';
    end if;
    v_rail := 'internal';
    v_own := d.owner_id = a.owner_id;
    if v_own then
      v_cp_name := d.nickname || ' ••' || right(d.account_number, 4);
    end if;
  elsif p_beneficiary is null then
    raise exception 'Choose a beneficiary or one of your accounts' using errcode = '22023';
  else
    v_rail := coalesce(nullif(p_rail, 'internal'), 'ach');
  end if;

  v_fee := case when p_kind = 'bill_payment' then private.fee('bill_payment', p_amount)
                else private.rail_fee(v_rail, p_amount) end;

  if p_enforce_limit and not v_own then
    v_used := private.outgoing_today(a.id);
    if v_used + p_amount > a.daily_transfer_limit_cents then
      raise exception 'This transfer exceeds your daily transfer limit of %. Remaining today: %',
        private.money(a.daily_transfer_limit_cents),
        private.money(greatest(a.daily_transfer_limit_cents - v_used, 0))
        using errcode = '22023', hint = 'DAILY_LIMIT';
    end if;
  end if;

  select flags into v_flags from public.sim_state where id = 1;
  v_review := not v_own and p_kind = 'transfer' and p_amount >= 1000000; -- $10,000+ goes to manual review
  v_immediate := (v_rail in ('internal', 'instant') or p_kind = 'bill_payment') and not v_review;
  v_settle := case
    when v_immediate then v_now
    when v_rail = 'wire' then v_now + interval '1 day'
    when coalesce((v_flags ->> 'ach_delay')::boolean, false) then v_now + interval '4 days'
    else v_now + interval '2 days' end;

  v_desc := coalesce(nullif(trim(p_memo), ''),
    case when p_kind = 'bill_payment' then 'Bill payment to ' || v_cp_name
         when v_own then 'Transfer to ' || v_cp_name
         else 'Transfer to ' || v_cp_name end);

  insert into public.transactions (
    kind, status, rail, direction, description, recipient_description, counterparty_name, category,
    amount_cents, fee_cents, account_id, counterparty_account_id, is_own_transfer, beneficiary_id,
    scheduled_payment_id, initiated_by, requires_review, settles_at, idempotency_key, created_at, metadata)
  values (
    p_kind, 'pending', v_rail, 'debit', v_desc,
    case when p_to_account is not null then
      case when v_own then 'Transfer from ' || a.nickname || ' ••' || right(a.account_number, 4)
           else 'Transfer from ' || coalesce(v_sender, 'ACME customer') end end,
    v_cp_name,
    coalesce(p_category, case when p_kind = 'bill_payment' then 'Bills & Utilities' else 'Transfers' end),
    p_amount, v_fee, a.id, p_to_account, v_own, p_beneficiary,
    p_scheduled, p_actor, v_review, v_settle, p_key, v_now,
    jsonb_build_object('memo', p_memo))
  returning id into v_txn;

  if a.available_cents < p_amount + v_fee then
    update public.transactions
       set status = 'failed', failure_reason = 'Insufficient funds'
     where id = v_txn;
    perform private.log_event('transfer.failed', 'warning',
      'Transfer of ' || private.money(p_amount) || ' from ' || a.nickname || ' declined: insufficient funds',
      a.owner_id, a.id, v_txn, jsonb_build_object('available_cents', a.available_cents, 'requested_cents', p_amount + v_fee));
    perform private.notify(a.owner_id, 'Payment declined',
      'Insufficient funds for ' || private.money(p_amount + v_fee) || ' — ' || v_desc || '.', 'error', '/accounts/' || a.id);
    return jsonb_build_object('id', v_txn, 'status', 'failed', 'fee_cents', v_fee,
      'failure_reason', 'Insufficient funds',
      'reference', (select reference from public.transactions where id = v_txn));
  end if;

  update public.accounts set pending_debits_cents = pending_debits_cents + p_amount + v_fee where id = a.id;
  update public.transactions set hold_cents = p_amount + v_fee where id = v_txn;

  if v_immediate then
    v_status := private.post_txn(v_txn);
  else
    v_status := 'pending';
    if v_review then
      perform private.notify(a.owner_id, 'Transfer under review',
        private.money(p_amount) || ' to ' || v_cp_name || ' is being reviewed by our team.', 'warning', '/transfers');
    end if;
  end if;

  perform private.log_event(
    case when v_review then 'transfer.review' when v_status = 'posted' then 'transfer.posted' else 'transfer.pending' end,
    case when v_review then 'warning' when v_status = 'posted' then 'success' else 'info' end,
    initcap(replace(p_kind::text, '_', ' ')) || ' of ' || private.money(p_amount) || ' via ' || v_rail ||
      ' from ' || coalesce(v_sender, '?') || ' to ' || v_cp_name || ' (' || v_status || ')',
    a.owner_id, a.id, v_txn, jsonb_build_object('rail', v_rail, 'fee_cents', v_fee));

  return jsonb_build_object('id', v_txn, 'status', v_status, 'fee_cents', v_fee, 'rail', v_rail,
    'requires_review', v_review, 'settles_at', v_settle,
    'reference', (select reference from public.transactions where id = v_txn));
end $$;

-- Fee/settlement quote shown before the customer confirms.
create or replace function public.quote_transfer(
  p_from uuid, p_amount bigint, p_rail public.transfer_rail default 'ach',
  p_to_account uuid default null, p_beneficiary uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare
  a public.accounts;
  b public.beneficiaries;
  v_rail public.transfer_rail;
  v_fee bigint;
  v_used bigint;
  v_own boolean := false;
  v_flags jsonb;
begin
  select * into a from public.accounts where id = p_from and owner_id = auth.uid();
  if not found then raise exception 'Source account not found' using errcode = 'P0002'; end if;
  if p_beneficiary is not null then
    select * into b from public.beneficiaries where id = p_beneficiary and owner_id = auth.uid();
    if not found then raise exception 'Beneficiary not found' using errcode = 'P0002'; end if;
    if b.internal_account_id is not null then p_to_account := b.internal_account_id; end if;
  end if;
  if p_to_account is not null then
    v_rail := 'internal';
    select owner_id = auth.uid() into v_own from public.accounts where id = p_to_account;
  else
    v_rail := coalesce(nullif(p_rail, 'internal'), 'ach');
  end if;
  select flags into v_flags from public.sim_state where id = 1;
  v_fee := private.rail_fee(v_rail, p_amount);
  v_used := private.outgoing_today(a.id);
  return jsonb_build_object(
    'rail', v_rail,
    'fee_cents', v_fee,
    'total_cents', p_amount + v_fee,
    'available_cents', a.available_cents,
    'sufficient_funds', a.available_cents >= p_amount + v_fee,
    'daily_limit_cents', a.daily_transfer_limit_cents,
    'limit_remaining_cents', case when coalesce(v_own, false) then null else greatest(a.daily_transfer_limit_cents - v_used, 0) end,
    'within_limit', coalesce(v_own, false) or v_used + p_amount <= a.daily_transfer_limit_cents,
    'requires_review', not coalesce(v_own, false) and p_amount >= 1000000,
    'internal', p_to_account is not null,
    'eta', case
      when not coalesce(v_own, false) and p_amount >= 1000000 then 'After manual review'
      when v_rail in ('internal', 'instant') then 'Instantly'
      when v_rail = 'wire' then 'Next business day'
      when coalesce((v_flags ->> 'ach_delay')::boolean, false) then '3–4 business days (network delays)'
      else '1–2 business days' end);
end $$;

create or replace function public.create_transfer(
  p_from uuid, p_amount bigint, p_rail public.transfer_rail default 'ach',
  p_to_account uuid default null, p_beneficiary uuid default null,
  p_memo text default null, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if auth.uid() is null or not public.owns_account(p_from) then
    raise exception 'Source account not found' using errcode = 'P0002';
  end if;
  return private.do_transfer(auth.uid(), p_from, p_amount, p_rail, p_to_account, p_beneficiary,
    p_memo, p_idempotency_key);
end $$;

create or replace function public.cancel_transfer(p_txn uuid)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare t public.transactions;
begin
  select * into t from public.transactions where id = p_txn;
  if not found or not public.owns_account(t.account_id) then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if t.status <> 'pending' then
    raise exception 'Only pending transfers can be cancelled' using errcode = '22023';
  end if;
  perform private.release_txn(p_txn, 'cancelled', 'Cancelled by customer');
  perform private.log_event('transfer.cancelled', 'info',
    'Customer cancelled pending transfer ' || t.reference, auth.uid(), t.account_id, t.id);
end $$;

-- Staff decision on transfers held for review.
create or replace function public.review_transfer(p_txn uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  t public.transactions;
  v_owner uuid;
  v_status public.txn_status := 'pending';
begin
  if not public.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into t from public.transactions where id = p_txn for update;
  if not found or t.status <> 'pending' or not t.requires_review then
    raise exception 'This transfer is not awaiting review' using errcode = '22023';
  end if;
  select owner_id into v_owner from public.accounts where id = t.account_id;
  if p_approve then
    update public.transactions set requires_review = false, review_note = p_note where id = t.id;
    if t.rail in ('internal', 'instant') or t.settles_at <= public.sim_now() then
      v_status := private.post_txn(t.id);
    end if;
    perform private.notify(v_owner, 'Transfer approved',
      private.money(t.amount_cents) || ' to ' || t.counterparty_name || ' was approved.', 'success', '/transfers');
  else
    update public.transactions set review_note = p_note where id = t.id;
    perform private.release_txn(t.id, 'cancelled', coalesce(nullif(p_note, ''), 'Rejected after review'));
    v_status := 'cancelled';
    perform private.notify(v_owner, 'Transfer rejected',
      private.money(t.amount_cents) || ' to ' || t.counterparty_name || ' was not approved.', 'error', '/transfers');
  end if;
  perform private.log_event(case when p_approve then 'review.approved' else 'review.rejected' end,
    case when p_approve then 'success' else 'warning' end,
    'Transfer ' || t.reference || ' ' || case when p_approve then 'approved' else 'rejected' end || ' by staff',
    v_owner, t.account_id, t.id, jsonb_build_object('note', p_note));
  return jsonb_build_object('status', v_status);
end $$;

-- Settles pending transactions whose settlement time has passed.
create or replace function private.settle_due()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record;
  n int := 0;
  v_status public.txn_status;
begin
  for r in
    select id, reference, account_id, amount_cents, direction, description
    from public.transactions
    where status = 'pending' and not requires_review and settles_at <= public.sim_now()
    order by settles_at, created_at
  loop
    v_status := private.post_txn(r.id);
    n := n + 1;
    perform private.log_event(
      case when v_status = 'posted' then 'settlement.posted' else 'settlement.failed' end,
      case when v_status = 'posted' then 'success' else 'error' end,
      'Settled ' || r.reference || ' — ' || r.description || ' (' || private.money(r.amount_cents) || ')',
      (select owner_id from public.accounts where id = r.account_id), r.account_id, r.id);
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Deposits (simulated external inflows)
-- ---------------------------------------------------------------------------
create or replace function private.do_deposit(
  p_account uuid, p_amount bigint, p_description text,
  p_method text default 'cash', p_kind public.txn_kind default 'deposit',
  p_category text default 'Income', p_counterparty text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.accounts;
  v_now timestamptz := public.sim_now();
  v_settle timestamptz;
  v_txn uuid;
  v_status public.txn_status := 'pending';
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than $0.00' using errcode = '22023';
  end if;
  select * into a from public.accounts where id = p_account for update;
  if not found or a.is_system then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if a.status = 'closed' then raise exception 'This account is closed' using errcode = '22023'; end if;

  v_settle := case p_method
    when 'ach' then v_now + interval '1 day'
    when 'check' then v_now + interval '2 days'
    else v_now end;

  insert into public.transactions (kind, status, rail, direction, description, counterparty_name, category,
    amount_cents, account_id, settles_at, created_at, metadata)
  values (p_kind, 'pending', case when p_method = 'ach' then 'ach'::public.transfer_rail
                                  when p_method = 'wire' then 'wire'::public.transfer_rail end,
    'credit', p_description, p_counterparty, p_category, p_amount, a.id, v_settle, v_now,
    jsonb_build_object('method', p_method))
  returning id into v_txn;

  if v_settle <= v_now then
    v_status := private.post_txn(v_txn);
    if p_kind in ('deposit', 'payroll') then
      perform private.notify(a.owner_id, 'Deposit received',
        private.money(p_amount) || ' — ' || p_description, 'success', '/accounts/' || a.id);
    end if;
  end if;

  perform private.log_event('deposit.' || v_status, 'success',
    initcap(p_kind::text) || ' of ' || private.money(p_amount) || ' to ' || a.nickname || ' via ' || p_method ||
    ' (' || v_status || ')', a.owner_id, a.id, v_txn);

  return jsonb_build_object('id', v_txn, 'status', v_status, 'settles_at', v_settle,
    'reference', (select reference from public.transactions where id = v_txn));
end $$;

create or replace function public.simulate_deposit(
  p_account uuid, p_amount bigint, p_method text default 'cash', p_description text default null)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not (public.owns_account(p_account) or public.is_staff()) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if p_amount > 5000000 then
    raise exception 'Simulated deposits are limited to $50,000.00' using errcode = '22023';
  end if;
  if p_method not in ('cash', 'ach', 'check', 'wire') then
    raise exception 'Unsupported deposit method' using errcode = '22023';
  end if;
  return private.do_deposit(p_account, p_amount,
    coalesce(nullif(trim(p_description), ''), case p_method
      when 'cash' then 'Cash deposit — ACME ATM'
      when 'ach' then 'Incoming ACH transfer'
      when 'check' then 'Mobile check deposit'
      when 'wire' then 'Incoming wire transfer' end),
    p_method, 'deposit', 'Income', 'Simulated deposit');
end $$;

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------
create or replace function private.do_card_purchase(
  p_card uuid, p_amount bigint, p_merchant text, p_category text default 'Shopping',
  p_channel text default 'in_store', p_international boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.cards;
  a public.accounts;
  v_now timestamptz := public.sim_now();
  v_fee bigint := 0;
  v_reason text;
  v_day bigint;
  v_month bigint;
  v_txn uuid;
  v_status public.txn_status;
  v_prefs jsonb;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than $0.00' using errcode = '22023';
  end if;
  select * into c from public.cards where id = p_card for update;
  if not found then raise exception 'Card not found' using errcode = 'P0002'; end if;
  select * into a from public.accounts where id = c.account_id for update;

  if p_international then v_fee := private.fee('card_foreign', p_amount); end if;

  select
    coalesce(sum(amount_cents) filter (where private.local_date(created_at) = private.local_date(v_now)), 0),
    coalesce(sum(amount_cents) filter (where date_trunc('month', created_at at time zone 'America/New_York')
                                             = date_trunc('month', v_now at time zone 'America/New_York')), 0)
    into v_day, v_month
  from public.transactions
  where card_id = c.id and status = 'posted' and kind = 'card_purchase';

  v_reason := case
    when c.status = 'locked' then 'Card is locked'
    when c.status = 'cancelled' then 'Card is cancelled'
    when a.status <> 'active' then 'Account is ' || a.status
    when p_channel = 'online' and not c.online_enabled then 'Online purchases are disabled for this card'
    when p_channel = 'contactless' and not c.contactless_enabled then 'Contactless payments are disabled for this card'
    when p_international and not c.international_enabled then 'International purchases are disabled for this card'
    when v_day + p_amount > c.daily_limit_cents then 'Daily card spending limit exceeded'
    when v_month + p_amount > c.monthly_limit_cents then 'Monthly card spending limit exceeded'
    when a.available_cents < p_amount + v_fee then 'Insufficient funds'
  end;

  insert into public.transactions (kind, status, direction, description, counterparty_name, category,
    amount_cents, fee_cents, account_id, card_id, initiated_by, settles_at, created_at, metadata)
  values ('card_purchase', 'pending', 'debit', p_merchant, p_merchant, coalesce(p_category, 'Shopping'),
    p_amount, v_fee, a.id, c.id, c.owner_id, v_now, v_now,
    jsonb_build_object('channel', p_channel, 'international', p_international, 'card_last4', c.last4))
  returning id into v_txn;

  if v_reason is not null then
    update public.transactions set status = 'failed', failure_reason = v_reason where id = v_txn;
    perform private.notify(c.owner_id, 'Card payment declined',
      private.money(p_amount) || ' at ' || p_merchant || ' — ' || v_reason || '.', 'error', '/cards');
    perform private.log_event('card.declined', 'warning',
      'Card ••' || c.last4 || ' declined at ' || p_merchant || ' for ' || private.money(p_amount) || ': ' || v_reason,
      c.owner_id, a.id, v_txn);
    return jsonb_build_object('id', v_txn, 'status', 'failed', 'failure_reason', v_reason);
  end if;

  update public.accounts set pending_debits_cents = pending_debits_cents + p_amount + v_fee where id = a.id;
  update public.transactions set hold_cents = p_amount + v_fee where id = v_txn;
  v_status := private.post_txn(v_txn);

  select preferences into v_prefs from public.profiles where id = c.owner_id;
  if p_amount >= coalesce((v_prefs ->> 'large_transaction_alert_cents')::bigint, 50000) then
    perform private.notify(c.owner_id, 'Large card purchase',
      private.money(p_amount) || ' at ' || p_merchant || ' with card ••' || c.last4 || '.', 'info', '/cards');
  end if;
  perform private.log_event('card.purchase', 'info',
    'Card ••' || c.last4 || ' charged ' || private.money(p_amount) || ' at ' || p_merchant, c.owner_id, a.id, v_txn);
  return jsonb_build_object('id', v_txn, 'status', v_status, 'fee_cents', v_fee);
end $$;

create or replace function public.simulate_card_purchase(
  p_card uuid, p_amount bigint, p_merchant text, p_category text default 'Shopping',
  p_channel text default 'in_store', p_international boolean default false)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not exists (select 1 from public.cards where id = p_card and (owner_id = auth.uid() or public.is_staff())) then
    raise exception 'Card not found' using errcode = 'P0002';
  end if;
  if p_channel not in ('in_store', 'online', 'contactless') then
    raise exception 'Unsupported channel' using errcode = '22023';
  end if;
  return private.do_card_purchase(p_card, p_amount, coalesce(nullif(trim(p_merchant), ''), 'Merchant'),
    p_category, p_channel, p_international);
end $$;

create or replace function public.set_card_status(p_card uuid, p_locked boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare c public.cards;
begin
  select * into c from public.cards where id = p_card;
  if not found or not (c.owner_id = auth.uid() or public.is_staff()) then
    raise exception 'Card not found' using errcode = 'P0002';
  end if;
  if c.status = 'cancelled' then raise exception 'This card is cancelled' using errcode = '22023'; end if;
  update public.cards
     set status = case when p_locked then 'locked'::public.card_status else 'active'::public.card_status end,
         status_reason = case when p_locked then coalesce(p_reason, 'Locked by cardholder') end
   where id = p_card;
  perform private.log_event(case when p_locked then 'card.locked' else 'card.unlocked' end,
    case when p_locked then 'warning' else 'info' end,
    'Card ••' || c.last4 || case when p_locked then ' locked' else ' unlocked' end, c.owner_id, c.account_id);
  perform private.notify(c.owner_id, case when p_locked then 'Card locked' else 'Card unlocked' end,
    'Your card ending in ' || c.last4 || case when p_locked then ' is locked. New purchases will be declined.'
                                              else ' is active again.' end,
    case when p_locked then 'warning' else 'success' end, '/cards');
end $$;

create or replace function public.update_card_settings(
  p_card uuid, p_daily_limit bigint, p_monthly_limit bigint,
  p_online boolean, p_contactless boolean, p_international boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare c public.cards;
begin
  select * into c from public.cards where id = p_card;
  if not found or not (c.owner_id = auth.uid() or public.is_staff()) then
    raise exception 'Card not found' using errcode = 'P0002';
  end if;
  if p_daily_limit < 0 or p_daily_limit > 1000000 then
    raise exception 'Daily limit must be between $0 and $10,000' using errcode = '22023';
  end if;
  if p_monthly_limit < p_daily_limit or p_monthly_limit > 5000000 then
    raise exception 'Monthly limit must be at least the daily limit and at most $50,000' using errcode = '22023';
  end if;
  update public.cards set daily_limit_cents = p_daily_limit, monthly_limit_cents = p_monthly_limit,
    online_enabled = p_online, contactless_enabled = p_contactless, international_enabled = p_international
  where id = p_card;
  perform private.log_event('card.settings', 'info',
    'Card ••' || c.last4 || ' limits set to ' || private.money(p_daily_limit) || '/day, ' ||
    private.money(p_monthly_limit) || '/month', c.owner_id, c.account_id);
end $$;

create or replace function private.issue_card(p_account uuid, p_daily bigint default 150000)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.accounts;
  v_name text;
  v_id uuid;
  v_now timestamptz := public.sim_now();
begin
  select * into a from public.accounts where id = p_account;
  select upper(full_name) into v_name from public.profiles where id = a.owner_id;
  insert into public.cards (account_id, owner_id, cardholder_name, last4, expiry_month, expiry_year,
                            daily_limit_cents, issued_at)
  values (a.id, a.owner_id, coalesce(v_name, 'ACME CUSTOMER'), lpad((floor(random() * 10000))::int::text, 4, '0'),
          extract(month from v_now)::int, extract(year from v_now)::int + 4, p_daily, v_now)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.replace_card(p_card uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  c public.cards;
  v_new uuid;
  v_fee bigint := private.fee('card_replacement', 0);
  v_txn uuid;
  a public.accounts;
begin
  select * into c from public.cards where id = p_card;
  if not found or c.owner_id <> auth.uid() then raise exception 'Card not found' using errcode = 'P0002'; end if;
  if c.status = 'cancelled' then raise exception 'This card is already cancelled' using errcode = '22023'; end if;
  select * into a from public.accounts where id = c.account_id for update;
  if a.available_cents < v_fee then
    raise exception 'Insufficient funds for the % replacement fee', private.money(v_fee) using errcode = '22023';
  end if;
  update public.cards set status = 'cancelled', status_reason = 'Reported lost or damaged' where id = c.id;
  v_new := private.issue_card(c.account_id, c.daily_limit_cents);
  if v_fee > 0 then
    insert into public.transactions (kind, status, direction, description, category, amount_cents, account_id,
                                     card_id, initiated_by, hold_cents, settles_at)
    values ('fee', 'pending', 'debit', 'Card replacement fee', 'Fees', v_fee, a.id, c.id, auth.uid(), v_fee, public.sim_now())
    returning id into v_txn;
    update public.accounts set pending_debits_cents = pending_debits_cents + v_fee where id = a.id;
    perform private.post_txn(v_txn);
  end if;
  perform private.log_event('card.replaced', 'info', 'Card ••' || c.last4 || ' replaced', c.owner_id, c.account_id);
  perform private.notify(c.owner_id, 'Replacement card issued',
    'Your old card ending in ' || c.last4 || ' was cancelled. A new card is on its way.', 'success', '/cards');
  return jsonb_build_object('card_id', v_new, 'fee_cents', v_fee);
end $$;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create or replace function public.update_transfer_limit(p_account uuid, p_limit bigint)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not (public.owns_account(p_account) or public.is_staff()) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  if p_limit < 10000 or p_limit > 2500000 then
    raise exception 'Daily transfer limit must be between $100 and $25,000' using errcode = '22023';
  end if;
  update public.accounts set daily_transfer_limit_cents = p_limit where id = p_account;
  perform private.log_event('account.limit', 'info',
    'Daily transfer limit set to ' || private.money(p_limit), auth.uid(), p_account);
end $$;

create or replace function private.provision_account(
  p_owner uuid, p_type public.account_type, p_nickname text, p_initial bigint, p_with_card boolean default true)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  insert into public.accounts (owner_id, type, nickname, account_number, interest_rate_bps, opened_at)
  values (p_owner, p_type, p_nickname, private.new_account_number(),
          case when p_type = 'savings' then 425 else 0 end, public.sim_now())
  returning id into v_id;
  if coalesce(p_initial, 0) > 0 then
    perform private.do_deposit(v_id, p_initial, 'Opening deposit', 'cash', 'opening_deposit', 'Income', 'Account opening');
  end if;
  if p_type = 'checking' and p_with_card then
    perform private.issue_card(v_id);
  end if;
  perform private.log_event('account.opened', 'success',
    'Opened ' || p_type || ' account "' || p_nickname || '"', p_owner, v_id);
  return v_id;
end $$;

-- Existing (verified) customers can open additional accounts instantly.
create or replace function public.open_additional_account(
  p_type public.account_type, p_nickname text, p_initial_deposit bigint default 0)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_id uuid;
  v_kyc text;
begin
  select kyc_status into v_kyc from public.profiles where id = auth.uid();
  if v_kyc is distinct from 'verified' then
    raise exception 'Complete the account opening application first' using errcode = '42501';
  end if;
  if (select count(*) from public.accounts where owner_id = auth.uid() and status <> 'closed') >= 6 then
    raise exception 'You can have up to 6 open accounts' using errcode = '22023';
  end if;
  if p_initial_deposit < 0 or p_initial_deposit > 2500000 then
    raise exception 'Opening deposit must be between $0 and $25,000' using errcode = '22023';
  end if;
  v_id := private.provision_account(auth.uid(), p_type,
    coalesce(nullif(trim(p_nickname), ''), initcap(p_type::text)), p_initial_deposit);
  perform private.notify(auth.uid(), 'New account opened',
    'Your ' || p_type || ' account is ready to use.', 'success', '/accounts/' || v_id);
  return v_id;
end $$;

-- New customer onboarding with simulated identity verification (KYC).
create or replace function public.submit_account_application(
  p_full_name text, p_date_of_birth date, p_phone text,
  p_address_line1 text, p_city text, p_state text, p_postal_code text,
  p_ssn_last4 text, p_employment_status text, p_annual_income bigint,
  p_account_type public.account_type, p_initial_deposit bigint)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_app uuid;
  v_score int := 10;
  v_manual boolean;
  v_flags jsonb;
  v_account uuid;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if exists (select 1 from public.account_applications where user_id = v_uid and status = 'pending_review') then
    raise exception 'You already have an application under review' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and kyc_status = 'verified') then
    raise exception 'Your identity is already verified — open accounts from the Accounts page' using errcode = '22023';
  end if;
  if p_date_of_birth > (current_date - interval '18 years') then
    raise exception 'You must be at least 18 years old to open an account' using errcode = '22023';
  end if;
  if p_initial_deposit < 0 or p_initial_deposit > 2500000 then
    raise exception 'Opening deposit must be between $0 and $25,000' using errcode = '22023';
  end if;
  if p_ssn_last4 !~ '^[0-9]{4}$' then
    raise exception 'Enter the last 4 digits of your SSN' using errcode = '22023';
  end if;

  select flags into v_flags from public.sim_state where id = 1;
  if p_initial_deposit >= 1000000 then v_score := v_score + 40; end if;
  if p_employment_status = 'unemployed' then v_score := v_score + 15; end if;
  if p_ssn_last4 = '0000' then v_score := v_score + 60; end if;
  v_manual := v_score >= 50 or coalesce((v_flags ->> 'manual_kyc')::boolean, false);

  update public.profiles
     set full_name = trim(p_full_name), date_of_birth = p_date_of_birth, phone = p_phone,
         address_line1 = p_address_line1, city = p_city, state = upper(p_state), postal_code = p_postal_code
   where id = v_uid;

  insert into public.account_applications (user_id, account_type, status, full_name, date_of_birth, phone,
    address_line1, city, state, postal_code, ssn_last4, employment_status, annual_income_cents,
    initial_deposit_cents, risk_score)
  values (v_uid, p_account_type, 'pending_review', trim(p_full_name), p_date_of_birth, p_phone,
    p_address_line1, p_city, upper(p_state), p_postal_code, p_ssn_last4, p_employment_status,
    coalesce(p_annual_income, 0), p_initial_deposit, v_score)
  returning id into v_app;

  perform private.log_event('application.submitted', 'info',
    trim(p_full_name) || ' submitted an application (risk score ' || v_score || ')', v_uid, null, null,
    jsonb_build_object('application_id', v_app));

  if v_manual then
    -- Bypass the column guard: this runs as the definer for the caller's own row.
    update public.profiles set kyc_status = 'pending_review' where id = v_uid;
    perform private.notify(v_uid, 'Application under review',
      'Thanks! Our team is verifying your details. This usually takes less than one business day.', 'info', '/open-account');
    return jsonb_build_object('application_id', v_app, 'status', 'pending_review');
  end if;

  v_account := private.approve_application(v_app, null, 'Automatically verified');
  return jsonb_build_object('application_id', v_app, 'status', 'approved', 'account_id', v_account);
end $$;

create or replace function private.approve_application(p_app uuid, p_staff uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  app public.account_applications;
  v_account uuid;
begin
  select * into app from public.account_applications where id = p_app for update;
  update public.profiles
     set kyc_status = 'verified',
         customer_number = coalesce(customer_number, 'C' || nextval('public.customer_number_seq'))
   where id = app.user_id;
  v_account := private.provision_account(app.user_id, app.account_type,
    case when app.account_type = 'checking' then 'Everyday Checking' else 'High-Yield Savings' end,
    app.initial_deposit_cents);
  update public.account_applications
     set status = 'approved', decided_by = p_staff, decided_at = public.sim_now(), decision_note = p_note,
         account_id = v_account
   where id = p_app;
  perform private.notify(app.user_id, 'Welcome to ACME Bank!',
    'Your identity is verified and your account is open.', 'success', '/dashboard');
  perform private.log_event('application.approved', 'success',
    app.full_name || '''s application was approved', app.user_id, v_account);
  return v_account;
end $$;

create or replace function public.decide_application(p_app uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare app public.account_applications;
begin
  if not public.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into app from public.account_applications where id = p_app;
  if not found or app.status <> 'pending_review' then
    raise exception 'This application is not awaiting review' using errcode = '22023';
  end if;
  if p_approve then
    perform private.approve_application(p_app, auth.uid(), p_note);
  else
    update public.account_applications
       set status = 'rejected', decided_by = auth.uid(), decided_at = public.sim_now(), decision_note = p_note
     where id = p_app;
    update public.profiles set kyc_status = 'rejected' where id = app.user_id;
    perform private.notify(app.user_id, 'Application not approved',
      coalesce(nullif(p_note, ''), 'We could not verify your identity. Contact support for help.'), 'error', '/open-account');
    perform private.log_event('application.rejected', 'warning',
      app.full_name || '''s application was rejected', app.user_id);
  end if;
end $$;

-- Staff: freeze / unfreeze accounts
create or replace function public.set_account_status(p_account uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare a public.accounts;
begin
  if not public.is_staff() then raise exception 'Staff only' using errcode = '42501'; end if;
  select * into a from public.accounts where id = p_account and not is_system;
  if not found then raise exception 'Account not found' using errcode = 'P0002'; end if;
  if p_status = 'closed' and a.balance_cents <> 0 then
    raise exception 'Only accounts with a zero balance can be closed' using errcode = '22023';
  end if;
  update public.accounts set status = p_status, status_reason = p_reason where id = p_account;
  perform private.notify(a.owner_id, 'Account ' || p_status::text,
    a.nickname || ' is now ' || p_status::text || coalesce(' — ' || p_reason, '') || '.',
    case when p_status = 'active' then 'success' else 'warning' end, '/accounts/' || a.id);
  perform private.log_event('account.' || p_status::text, 'warning',
    a.nickname || ' ••' || right(a.account_number, 4) || ' set to ' || p_status::text, a.owner_id, a.id, null,
    jsonb_build_object('reason', p_reason));
end $$;

-- Admin: change roles
create or replace function public.set_user_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user;
  perform private.log_event('user.role', 'warning', 'Role changed to ' || p_role::text, p_user);
end $$;

-- ---------------------------------------------------------------------------
-- Scheduled payments
-- ---------------------------------------------------------------------------
create or replace function private.next_date(p_date date, p_freq public.schedule_frequency)
returns date language sql immutable as $$
  select case p_freq
    when 'weekly' then p_date + 7
    when 'biweekly' then p_date + 14
    when 'monthly' then (p_date + interval '1 month')::date
    else null end;
$$;

create or replace function private.run_scheduled_payments()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s record;
  v_res jsonb;
  v_today date := private.local_date(public.sim_now());
  n int := 0;
  v_next date;
begin
  for s in
    select * from public.scheduled_payments
    where status = 'active' and next_run_date <= v_today
    order by next_run_date, created_at
  loop
    begin
      v_res := private.do_transfer(s.owner_id, s.from_account_id, s.amount_cents, 'ach', s.to_account_id,
        s.beneficiary_id, s.description, 'sched-' || s.id || '-' || s.next_run_date,
        case when s.to_account_id is not null then 'transfer'::public.txn_kind else 'bill_payment'::public.txn_kind end,
        s.id, false);
    exception when others then
      v_res := jsonb_build_object('status', 'failed', 'failure_reason', sqlerrm);
    end;
    v_next := private.next_date(s.next_run_date, s.frequency);
    update public.scheduled_payments
       set last_run_at = public.sim_now(),
           last_result = coalesce(v_res ->> 'failure_reason', v_res ->> 'status'),
           run_count = run_count + 1,
           next_run_date = coalesce(v_next, next_run_date),
           status = case when v_next is null or (end_date is not null and v_next > end_date)
                         then 'completed'::public.schedule_status else status end
     where id = s.id;
    if v_res ->> 'status' = 'failed' then
      perform private.notify(s.owner_id, 'Scheduled payment failed',
        s.description || ' (' || private.money(s.amount_cents) || ') — ' || coalesce(v_res ->> 'failure_reason', 'error') || '.',
        'error', '/payments');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.run_scheduled_payment_now(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare s public.scheduled_payments;
begin
  select * into s from public.scheduled_payments where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Scheduled payment not found' using errcode = 'P0002'; end if;
  if s.status <> 'active' then raise exception 'Only active schedules can run' using errcode = '22023'; end if;
  update public.scheduled_payments set next_run_date = private.local_date(public.sim_now()) where id = p_id;
  perform private.run_scheduled_payments();
  return (select jsonb_build_object('last_result', last_result, 'next_run_date', next_run_date, 'status', status)
          from public.scheduled_payments where id = p_id);
end $$;

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

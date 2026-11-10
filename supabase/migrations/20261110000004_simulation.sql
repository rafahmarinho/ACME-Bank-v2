-- ACME Bank — simulation engine: demo data generator, clock advance, scenarios, reset.

create or replace function private.rand_cents(p_lo bigint, p_hi bigint)
returns bigint language sql volatile as $$
  select p_lo + floor(random() * (p_hi - p_lo + 1))::bigint;
$$;

create or replace function private.pick(p_items text[])
returns text language sql volatile as $$
  select p_items[1 + floor(random() * array_length(p_items, 1))::int];
$$;

create or replace function private.local_ts(p_day date, p_time time)
returns timestamptz language sql stable as $$
  select (p_day + p_time) at time zone 'America/New_York';
$$;

create or replace function private.random_merchant(out merchant text, out category text, out lo bigint, out hi bigint)
language plpgsql volatile as $$
declare r double precision := random();
begin
  if r < 0.30 then
    category := 'Groceries'; lo := 1200; hi := 14500;
    merchant := private.pick(array['FreshCart Market', 'Green Basket Grocers', 'Harvest Lane Foods', 'Corner Pantry']);
  elsif r < 0.52 then
    category := 'Dining'; lo := 650; hi := 8500;
    merchant := private.pick(array['Blue Fern Café', 'Luigi''s Trattoria', 'Sunrise Bagels', 'Noodle House 88', 'The Copper Grill']);
  elsif r < 0.64 then
    category := 'Transport'; lo := 300; hi := 6500;
    merchant := private.pick(array['MetroRide Transit', 'QuickCab', 'FuelUp Station', 'ParkSmart Garage']);
  elsif r < 0.80 then
    category := 'Shopping'; lo := 1500; hi := 22000;
    merchant := private.pick(array['Northwind Outfitters', 'Pixel & Co Electronics', 'HomeNest Goods', 'PaperTrail Books']);
  elsif r < 0.90 then
    category := 'Entertainment'; lo := 999; hi := 9000;
    merchant := private.pick(array['StreamFlix', 'Starlight Cinemas', 'Arcadia Games', 'Riverside Concert Hall']);
  elsif r < 0.97 then
    category := 'Health'; lo := 1500; hi := 12000;
    merchant := private.pick(array['WellPoint Pharmacy', 'PeakFit Gym', 'BrightSmile Dental']);
  else
    category := 'Travel'; lo := 8900; hi := 65000;
    merchant := private.pick(array['SkyBridge Airlines', 'Harbor View Hotel', 'RoadTrip Rentals']);
  end if;
end $$;

create or replace function private.charge_fee(p_account uuid, p_amount bigint, p_description text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_txn uuid;
begin
  insert into public.transactions (kind, status, direction, description, category, amount_cents, account_id,
                                   hold_cents, settles_at)
  values ('fee', 'pending', 'debit', p_description, 'Fees', p_amount, p_account, p_amount, public.sim_now())
  returning id into v_txn;
  update public.accounts set pending_debits_cents = pending_debits_cents + p_amount where id = p_account;
  perform private.post_txn(v_txn);
  return v_txn;
end $$;

-- First day of a new month: pay savings interest, assess maintenance fees.
create or replace function private.month_end()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a record;
  v bigint;
  n int := 0;
  v_fee bigint := private.fee('monthly_maintenance', 0);
begin
  for a in select * from public.accounts where not is_system and status = 'active' loop
    if a.type = 'savings' and a.balance_cents > 0 and a.interest_rate_bps > 0 then
      v := round(a.balance_cents * a.interest_rate_bps / 10000.0 / 12.0)::bigint;
      if v > 0 then
        perform private.do_deposit(a.id, v, 'Interest earned (' || (a.interest_rate_bps / 100.0)::numeric(5,2) || '% APY)',
          'cash', 'interest', 'Interest', 'ACME Bank');
        n := n + 1;
      end if;
    elsif a.type = 'checking' and a.balance_cents < 150000 and a.opened_at < public.sim_now() - interval '30 days'
          and a.available_cents >= v_fee then
      perform private.charge_fee(a.id, v_fee, 'Monthly maintenance fee');
      n := n + 1;
    end if;
  end loop;
  perform private.log_event('sim.month_end', 'info', 'Month-end processing: ' || n || ' interest/fee postings');
  return n;
end $$;

-- Generates one simulated day of customer activity for demo personas.
create or replace function private.sim_day_activity(p_day date)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c record;
  m record;
  v_t timestamptz := private.local_ts(p_day, '07:10');
  v_scenario text;
  v_max int;
  v_scale numeric;
  v_n int;
  v_count int := 0;
  v_dom int := extract(day from p_day)::int;
  v_dow int := extract(isodow from p_day)::int;
  v_channel text;
  v_ben uuid;
  i int;
begin
  select scenario into v_scenario from public.sim_state where id = 1;

  -- Income first thing in the morning
  perform private.set_clock(private.local_ts(p_day, '06:30'));
  for c in
    select p.id, p.persona, p.full_name,
           (select a.id from public.accounts a where a.owner_id = p.id and a.type = 'checking' and a.status = 'active'
            order by a.opened_at limit 1) as checking,
           (select a.id from public.accounts a where a.owner_id = p.id and a.type = 'savings' and a.status = 'active'
            order by a.opened_at limit 1) as savings
    from public.profiles p
    where p.is_demo and p.persona is not null and p.role = 'customer'
  loop
    continue when c.checking is null;
    if c.persona = 'salaried' and v_dom in (1, 15) then
      perform private.do_deposit(c.checking, 385000, 'Payroll — Brightline Analytics', 'cash', 'payroll', 'Income', 'Brightline Analytics');
    elsif c.persona = 'student' and v_dow = 5 then
      perform private.do_deposit(c.checking, private.rand_cents(52000, 68000), 'Payroll — Campus Bookstore', 'cash', 'payroll', 'Income', 'Campus Bookstore');
    elsif c.persona = 'affluent' and v_dom = 1 then
      perform private.do_deposit(c.checking, 1250000, 'Payroll — Meridian Capital Partners', 'cash', 'payroll', 'Income', 'Meridian Capital Partners');
    elsif c.persona = 'affluent' and v_dom = 15 and c.savings is not null then
      perform private.do_deposit(c.savings, private.rand_cents(60000, 110000), 'Dividend — Broad Market Index Fund', 'ach', 'deposit', 'Income', 'Meridian Brokerage');
    elsif c.persona = 'freelancer' and random() < 0.2 then
      perform private.do_deposit(c.checking, private.rand_cents(80000, 320000),
        'Client payment — ' || private.pick(array['Lumina Studio', 'Oakridge Media', 'Bright Path Labs', 'Kite & Key Agency']),
        'ach', 'deposit', 'Income', 'Client');
    elsif c.persona = 'business' and v_dow between 1 and 6 then
      perform private.do_deposit(c.checking, private.rand_cents(30000, 150000), 'Card sales settlement — Saffron & Salt Kitchen',
        'ach', 'deposit', 'Income', 'Payment processor');
    elsif c.persona = 'newcomer' and v_dow = 5 and (p_day - date '2024-01-05') % 14 = 0 then
      perform private.do_deposit(c.checking, 210000, 'Payroll — Northgate Logistics', 'cash', 'payroll', 'Income', 'Northgate Logistics');
    end if;
  end loop;

  -- Card spending during the day
  for c in
    select p.id, p.persona, cd.id as card_id
    from public.profiles p
    join lateral (
      select k.id from public.cards k
      where k.owner_id = p.id and k.status = 'active' order by k.issued_at desc limit 1
    ) cd on true
    where p.is_demo and p.persona is not null and p.role = 'customer'
  loop
    v_max := case c.persona when 'salaried' then 3 when 'student' then 3 when 'affluent' then 3
                            when 'business' then 2 when 'newcomer' then 2 else 2 end;
    v_scale := case c.persona when 'student' then 0.45 when 'affluent' then 2.4 when 'business' then 1.4
                              when 'newcomer' then 0.8 else 1 end;
    if v_scenario = 'shopping_spree' then v_max := v_max + 3; v_scale := v_scale * 1.6; end if;
    if v_scenario = 'insufficient_funds' and c.persona = 'student' then v_scale := v_scale * 3; end if;
    v_n := floor(random() * (v_max + 1))::int;
    for i in 1 .. v_n loop
      m := private.random_merchant();
      v_t := v_t + make_interval(mins => private.rand_cents(15, 65)::int);
      perform private.set_clock(v_t);
      v_channel := case when random() < 0.25 then 'online' when random() < 0.5 then 'contactless' else 'in_store' end;
      perform private.do_card_purchase(c.card_id, greatest(100, round(private.rand_cents(m.lo, m.hi) * v_scale)::bigint),
        m.merchant, m.category, v_channel, random() < 0.01);
      v_count := v_count + 1;
    end loop;
  end loop;

  -- Occasional person-to-person transfers
  for c in
    select p.id, p.persona,
           (select a.id from public.accounts a where a.owner_id = p.id and a.type = 'checking' and a.status = 'active'
            order by a.opened_at limit 1) as checking
    from public.profiles p
    where p.is_demo and p.persona in ('salaried', 'freelancer', 'affluent') and p.role = 'customer'
  loop
    continue when c.checking is null or random() > 0.08;
    select b.id into v_ben from public.beneficiaries b
      where b.owner_id = c.id and b.nickname = 'p2p' order by random() limit 1;
    continue when v_ben is null;
    v_t := v_t + make_interval(mins => 15);
    perform private.set_clock(v_t);
    perform private.do_transfer(c.id, c.checking, private.rand_cents(2500, 20000),
      case when random() < 0.5 then 'instant'::public.transfer_rail else 'ach'::public.transfer_rail end,
      null, v_ben, null, null, 'transfer', null, false);
    v_count := v_count + 1;
  end loop;

  perform private.set_clock(greatest(v_t, private.local_ts(p_day, '19:30')));
  return v_count;
end $$;

-- Processes one simulated day: month-end, settlements, schedules, activity.
create or replace function private.sim_process_day(p_day date, p_activity boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_settled int := 0;
  v_sched int := 0;
  v_act int := 0;
  v_me int := 0;
begin
  perform private.set_clock(private.local_ts(p_day, '00:05'));
  if extract(day from p_day) = 1 then
    v_me := private.month_end();
  end if;
  perform private.set_clock(private.local_ts(p_day, '06:00'));
  v_settled := private.settle_due();
  v_sched := private.run_scheduled_payments();
  if p_activity then
    v_act := private.sim_day_activity(p_day);
  end if;
  return jsonb_build_object('day', p_day, 'settled', v_settled, 'scheduled', v_sched, 'activity', v_act, 'month_end', v_me);
end $$;

create or replace function public.sim_advance(p_days int default 1)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_day date;
  v_res jsonb;
  v_settled int := 0;
  v_sched int := 0;
  v_act int := 0;
  v_auto boolean;
  i int;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_days < 1 or p_days > 31 then raise exception 'Advance between 1 and 31 days' using errcode = '22023'; end if;
  select auto_activity into v_auto from public.sim_state where id = 1;
  for i in 1 .. p_days loop
    v_day := private.local_date(public.sim_now()) + 1;
    v_res := private.sim_process_day(v_day, v_auto);
    v_settled := v_settled + (v_res ->> 'settled')::int;
    v_sched := v_sched + (v_res ->> 'scheduled')::int;
    v_act := v_act + (v_res ->> 'activity')::int;
    perform private.log_event('sim.day', 'info',
      'Simulated ' || to_char(v_day, 'Mon DD, YYYY') || ': ' || (v_res ->> 'settled') || ' settled, ' ||
      (v_res ->> 'scheduled') || ' scheduled payments, ' || (v_res ->> 'activity') || ' customer actions', null, null, null, v_res);
  end loop;
  return jsonb_build_object('days', p_days, 'sim_now', public.sim_now(),
    'settled', v_settled, 'scheduled', v_sched, 'activity', v_act);
end $$;

-- Settles anything already due without moving the clock.
create or replace function public.sim_process_now()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_settled int; v_sched int;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  v_settled := private.settle_due();
  v_sched := private.run_scheduled_payments();
  perform private.log_event('sim.process', 'info', 'Processed ' || v_settled || ' settlements and ' || v_sched || ' scheduled payments');
  return jsonb_build_object('settled', v_settled, 'scheduled', v_sched);
end $$;

create or replace function public.sim_set_auto_activity(p_enabled boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  update public.sim_state set auto_activity = p_enabled, updated_at = now() where id = 1;
  perform private.log_event('sim.config', 'info', 'Automatic customer activity ' || case when p_enabled then 'enabled' else 'disabled' end);
end $$;

-- ---------------------------------------------------------------------------
-- Scenarios
-- ---------------------------------------------------------------------------
create or replace function private.persona_checking(p_persona text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select a.id from public.accounts a join public.profiles p on p.id = a.owner_id
  where p.persona = p_persona and p.is_demo and a.type = 'checking' and a.status <> 'closed'
  order by a.opened_at limit 1;
$$;

create or replace function private.persona_beneficiary(p_persona text, p_name text)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select b.id from public.beneficiaries b join public.profiles p on p.id = b.owner_id
  where p.persona = p_persona and p.is_demo and b.name = p_name limit 1;
$$;

create or replace function public.sim_apply_scenario(p_code text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_msg text;
  v_acc uuid;
  v_card public.cards;
  v_owner uuid;
  v_ticket uuid;
  v_res jsonb;
  v_avail bigint;
  v_flags jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  select flags into v_flags from public.sim_state where id = 1;

  case p_code
  when 'baseline' then
    update public.sim_state set scenario = 'baseline', flags = '{}'::jsonb, updated_at = now() where id = 1;
    v_msg := 'Baseline mode: normal customer activity, standard settlement times, automatic KYC.';

  when 'payday' then
    perform private.do_deposit(private.persona_checking('salaried'), 385000, 'Payroll — Brightline Analytics', 'cash', 'payroll', 'Income', 'Brightline Analytics');
    perform private.do_deposit(private.persona_checking('student'), 64000, 'Payroll — Campus Bookstore', 'cash', 'payroll', 'Income', 'Campus Bookstore');
    perform private.do_deposit(private.persona_checking('affluent'), 1250000, 'Payroll — Meridian Capital Partners', 'cash', 'payroll', 'Income', 'Meridian Capital Partners');
    perform private.do_deposit(private.persona_checking('freelancer'), 275000, 'Client payment — Lumina Studio', 'ach', 'deposit', 'Income', 'Lumina Studio');
    perform private.do_deposit(private.persona_checking('business'), 182000, 'Card sales settlement — Saffron & Salt Kitchen', 'ach', 'deposit', 'Income', 'Payment processor');
    if private.persona_checking('newcomer') is not null then
      perform private.do_deposit(private.persona_checking('newcomer'), 210000, 'Payroll — Northgate Logistics', 'cash', 'payroll', 'Income', 'Northgate Logistics');
    end if;
    v_msg := 'Payday: salaries posted instantly; ACH client and card-sales deposits are pending until the next day.';

  when 'insufficient_funds' then
    v_acc := private.persona_checking('student');
    select available_cents into v_avail from public.accounts where id = v_acc;
    v_res := private.do_transfer((select owner_id from public.accounts where id = v_acc), v_acc, v_avail + 25000, 'ach',
      null, private.persona_beneficiary('student', 'Campus Housing Office'), 'Rent — Campus Housing', null, 'bill_payment', null, false);
    select * into v_card from public.cards where account_id = v_acc and status = 'active' limit 1;
    if v_card.id is not null then
      perform private.do_card_purchase(v_card.id, v_avail + 4999, 'Pixel & Co Electronics', 'Shopping', 'in_store', false);
    end if;
    update public.sim_state set scenario = 'insufficient_funds', updated_at = now() where id = 1;
    v_msg := 'Insufficient funds: Sofia''s rent payment and a card purchase were declined. Her spending is elevated while this mode is active.';

  when 'pending_transfers' then
    perform private.do_transfer(o.owner_id, o.id, 32000, 'ach', null, private.persona_beneficiary('salaried', 'Emma Bennett'),
      'Birthday gift', null, 'transfer', null, false)
      from public.accounts o where o.id = private.persona_checking('salaried');
    perform private.do_transfer(o.owner_id, o.id, 27500, 'ach', null, private.persona_beneficiary('freelancer', 'Daniel Reed'),
      'Concert tickets', null, 'transfer', null, false)
      from public.accounts o where o.id = private.persona_checking('freelancer');
    perform private.do_transfer(o.owner_id, o.id, 240000, 'wire', null, private.persona_beneficiary('business', 'Spice Route Imports'),
      'Invoice SR-2291', null, 'transfer', null, false)
      from public.accounts o where o.id = private.persona_checking('business');
    perform private.do_transfer(o.owner_id, o.id, 1250000, 'ach', null, private.persona_beneficiary('affluent', 'Meridian Brokerage'),
      'Quarterly investment', null, 'transfer', null, false)
      from public.accounts o join public.profiles p on p.id = o.owner_id
      where p.persona = 'affluent' and p.is_demo and o.type = 'savings' and o.status = 'active'
      limit 1;
    v_msg := 'Pending transfers: three outgoing ACH/wire transfers are pending, and a $12,500 transfer from James''s savings is held for staff review.';

  when 'shopping_spree' then
    select * into v_card from public.cards where account_id = private.persona_checking('salaried') and status = 'active' limit 1;
    perform private.do_card_purchase(v_card.id, 18999, 'Northwind Outfitters', 'Shopping', 'in_store', false);
    perform private.do_card_purchase(v_card.id, 64900, 'Pixel & Co Electronics', 'Shopping', 'online', false);
    perform private.do_card_purchase(v_card.id, 8450, 'Luigi''s Trattoria', 'Dining', 'contactless', false);
    perform private.do_card_purchase(v_card.id, 250000, 'Harbor View Hotel', 'Travel', 'online', false);
    update public.sim_state set scenario = 'shopping_spree', updated_at = now() where id = 1;
    v_msg := 'Shopping spree: several purchases on Olivia''s card — the $2,500 hotel booking exceeds her daily card limit and is declined.';

  when 'fraud_alert' then
    select * into v_card from public.cards where account_id = private.persona_checking('freelancer') and status = 'active' limit 1;
    if v_card.id is null then raise exception 'No active card for the freelancer persona' using errcode = 'P0002'; end if;
    perform private.do_card_purchase(v_card.id, 124900, 'ELECTROWORLD ONLINE (INTL)', 'Shopping', 'online', true);
    perform private.do_card_purchase(v_card.id, 98000, 'GIFTCARD HUB (INTL)', 'Shopping', 'online', true);
    update public.cards set status = 'locked', status_reason = 'Suspected fraud — locked by ACME Fraud Monitoring' where id = v_card.id;
    perform private.notify(v_card.owner_id, 'We locked your card',
      'We noticed unusual international activity on your card ending in ' || v_card.last4 ||
      '. Review it in Cards or contact support.', 'error', '/cards');
    insert into public.support_tickets (customer_id, subject, category, status, priority)
    values (v_card.owner_id, 'Suspicious activity on card ending ' || v_card.last4, 'fraud', 'open', 'urgent')
    returning id into v_ticket;
    insert into public.ticket_messages (ticket_id, author_id, body)
    values (v_ticket, v_card.owner_id,
      'Automated fraud alert: two international online purchases were attempted and declined. The card has been locked as a precaution.');
    perform private.log_event('fraud.alert', 'error', 'Fraud monitoring locked card ••' || v_card.last4, v_card.owner_id, v_card.account_id);
    v_msg := 'Fraud alert: suspicious international purchases on Marcus''s card were declined, the card was locked and an urgent ticket opened.';

  when 'ach_delay' then
    update public.sim_state set scenario = 'ach_delay', flags = v_flags || '{"ach_delay": true}'::jsonb, updated_at = now() where id = 1;
    v_msg := 'ACH network delay: new ACH transfers now take 4 days to settle instead of 2.';

  when 'manual_kyc' then
    update public.sim_state set scenario = 'manual_kyc', flags = v_flags || '{"manual_kyc": true}'::jsonb, updated_at = now() where id = 1;
    v_msg := 'Manual KYC: every new account application now waits for staff review.';

  else
    raise exception 'Unknown scenario %', p_code using errcode = '22023';
  end case;

  perform private.log_event('scenario.applied', 'info', 'Scenario "' || p_code || '": ' || v_msg, null, null, null,
    jsonb_build_object('scenario', p_code));
  return jsonb_build_object('scenario', p_code, 'message', v_msg);
end $$;

-- ---------------------------------------------------------------------------
-- Demo data reset: wipes banking data and regenerates two months of history
-- for the six demo customers (profiles with is_demo = true and a persona).
-- ---------------------------------------------------------------------------
create or replace function private.first_on_or_after(p_from date, p_dom int)
returns date language sql immutable as $$
  select case when extract(day from p_from)::int <= p_dom
    then (date_trunc('month', p_from)::date + (p_dom - 1))
    else ((date_trunc('month', p_from) + interval '1 month')::date + (p_dom - 1)) end;
$$;

create or replace function private.demo_beneficiary(p_owner uuid, p_name text, p_bank text, p_acct text, p_routing text,
  p_nickname text default null)
returns uuid language sql security definer set search_path = public, pg_temp as $$
  insert into public.beneficiaries (owner_id, name, bank_name, account_number, routing_number, nickname)
  values (p_owner, p_name, p_bank, p_acct, p_routing, p_nickname)
  returning id;
$$;

create or replace function private.demo_schedule(p_owner uuid, p_from uuid, p_ben uuid, p_to uuid, p_desc text,
  p_amount bigint, p_freq public.schedule_frequency, p_next date)
returns uuid language sql security definer set search_path = public, pg_temp as $$
  insert into public.scheduled_payments (owner_id, from_account_id, beneficiary_id, to_account_id, description,
    amount_cents, frequency, next_run_date, created_at)
  values (p_owner, p_from, p_ben, p_to, p_desc, p_amount, p_freq, p_next, public.sim_now())
  returning id;
$$;

create or replace function private.demo_provision(p_persona text, p_start date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  u uuid;
  chk uuid;
  sav uuid;
  b1 uuid; b2 uuid; b3 uuid;
  v_start date := p_start;
begin
  select id into u from public.profiles where persona = p_persona and is_demo limit 1;
  if u is null then return; end if;
  update public.profiles
     set kyc_status = 'verified',
         customer_number = coalesce(customer_number, 'C' || nextval('public.customer_number_seq'))
   where id = u;

  if p_persona = 'salaried' then
    chk := private.provision_account(u, 'checking', 'Everyday Checking', 420000);
    sav := private.provision_account(u, 'savings', 'Rainy Day Savings', 1250000, false);
    b1 := private.demo_beneficiary(u, 'Parkside Apartments', 'Lakeshore National Bank', '7781234501', '990000017');
    b2 := private.demo_beneficiary(u, 'City Power & Light', 'Pioneer Trust', '5523001987', '990000025');
    perform private.demo_beneficiary(u, 'Emma Bennett', 'Summit Federal Credit Union', '3304918822', '990000033', 'p2p');
    perform private.demo_schedule(u, chk, b1, null, 'Rent — Parkside Apartments', 195000, 'monthly', private.first_on_or_after(v_start, 1));
    perform private.demo_schedule(u, chk, b2, null, 'Electricity — City Power & Light', 9450, 'monthly', private.first_on_or_after(v_start, 20));
    perform private.demo_schedule(u, chk, null, sav, 'Monthly savings', 50000, 'monthly', private.first_on_or_after(v_start, 16));
  elsif p_persona = 'freelancer' then
    chk := private.provision_account(u, 'checking', 'Everyday Checking', 310000);
    sav := private.provision_account(u, 'savings', 'Tax Reserve', 600000, false);
    b1 := private.demo_beneficiary(u, 'Northline Coworking', 'Lakeshore National Bank', '7781239944', '990000017');
    perform private.demo_beneficiary(u, 'Daniel Reed', 'Summit Federal Credit Union', '3304917710', '990000033', 'p2p');
    perform private.demo_schedule(u, chk, b1, null, 'Desk membership — Northline Coworking', 35000, 'monthly', private.first_on_or_after(v_start, 5));
    perform private.demo_schedule(u, chk, null, sav, 'Tax reserve top-up', 40000, 'biweekly', v_start + 3);
    update public.cards set international_enabled = false where account_id = chk;
  elsif p_persona = 'student' then
    chk := private.provision_account(u, 'checking', 'Student Checking', 42000);
    b1 := private.demo_beneficiary(u, 'Lumen Mobile', 'Pioneer Trust', '5523004410', '990000025');
    b2 := private.demo_beneficiary(u, 'Campus Housing Office', 'Lakeshore National Bank', '7781230055', '990000017');
    perform private.demo_beneficiary(u, 'Maria Alvarez', 'Summit Federal Credit Union', '3304912234', '990000033', 'p2p');
    perform private.demo_schedule(u, chk, b1, null, 'Phone bill — Lumen Mobile', 6500, 'monthly', private.first_on_or_after(v_start, 20));
    perform private.demo_schedule(u, chk, b2, null, 'Rent — Campus Housing Office', 72000, 'monthly', private.first_on_or_after(v_start, 1));
    update public.cards set daily_limit_cents = 50000, monthly_limit_cents = 300000 where account_id = chk;
  elsif p_persona = 'affluent' then
    chk := private.provision_account(u, 'checking', 'Premier Checking', 2850000);
    sav := private.provision_account(u, 'savings', 'Premier Savings', 9800000, false);
    update public.accounts set daily_transfer_limit_cents = 2500000 where id = chk;
    update public.cards set daily_limit_cents = 500000, monthly_limit_cents = 3000000, international_enabled = true where account_id = chk;
    b1 := private.demo_beneficiary(u, 'Harborview Property Management', 'Lakeshore National Bank', '7781235566', '990000017');
    b2 := private.demo_beneficiary(u, 'Meridian Brokerage', 'Pioneer Trust', '5523007788', '990000025');
    b3 := private.demo_beneficiary(u, 'Open Fields Foundation', 'Summit Federal Credit Union', '3304916600', '990000033');
    perform private.demo_beneficiary(u, 'Claire Carter', 'Summit Federal Credit Union', '3304915511', '990000033', 'p2p');
    perform private.demo_schedule(u, chk, b1, null, 'Mortgage — Harborview Property Management', 420000, 'monthly', private.first_on_or_after(v_start, 1));
    perform private.demo_schedule(u, chk, b2, null, 'Monthly investment — Meridian Brokerage', 500000, 'monthly', private.first_on_or_after(v_start, 3));
    perform private.demo_schedule(u, chk, b3, null, 'Donation — Open Fields Foundation', 10000, 'monthly', private.first_on_or_after(v_start, 10));
  elsif p_persona = 'business' then
    chk := private.provision_account(u, 'checking', 'Kitchen Operating', 1840000);
    sav := private.provision_account(u, 'savings', 'Equipment Fund', 2200000, false);
    update public.accounts set daily_transfer_limit_cents = 1500000 where id = chk;
    update public.cards set daily_limit_cents = 300000, monthly_limit_cents = 2000000 where account_id = chk;
    b1 := private.demo_beneficiary(u, 'Fresh Farms Wholesale', 'Pioneer Trust', '5523002201', '990000025');
    b2 := private.demo_beneficiary(u, 'Spice Route Imports', 'Lakeshore National Bank', '7781237712', '990000017');
    b3 := private.demo_beneficiary(u, 'Kitchen Equipment Leasing Co', 'Summit Federal Credit Union', '3304913390', '990000033');
    perform private.demo_schedule(u, chk, b1, null, 'Produce order — Fresh Farms Wholesale', 120000, 'weekly', v_start + ((8 - extract(isodow from v_start)::int) % 7) + 1);
    perform private.demo_schedule(u, chk, b2, null, 'Spices — Spice Route Imports', 45000, 'biweekly', v_start + 6);
    perform private.demo_schedule(u, chk, b3, null, 'Oven lease — Kitchen Equipment Leasing Co', 89000, 'monthly', private.first_on_or_after(v_start, 12));
  elsif p_persona = 'newcomer' then
    chk := private.provision_account(u, 'checking', 'Everyday Checking', 150000);
    b1 := private.demo_beneficiary(u, 'Maple Street Rentals', 'Lakeshore National Bank', '7781231188', '990000017');
    perform private.demo_schedule(u, chk, b1, null, 'Rent — Maple Street Rentals', 140000, 'monthly', private.first_on_or_after(v_start, 1));
    insert into public.account_applications (user_id, account_type, status, full_name, date_of_birth, phone,
      address_line1, city, state, postal_code, ssn_last4, employment_status, annual_income_cents, initial_deposit_cents,
      risk_score, decision_note, decided_at, account_id, created_at)
    select u, 'checking', 'approved', p.full_name, coalesce(p.date_of_birth, date '1998-04-12'), coalesce(p.phone, '(555) 010-0006'),
      coalesce(p.address_line1, '18 Maple Street'), coalesce(p.city, 'Hartford'), coalesce(p.state, 'CT'),
      coalesce(p.postal_code, '06103'), '4821', 'employed', 5400000, 150000, 10, 'Automatically verified',
      public.sim_now(), chk, public.sim_now()
    from public.profiles p where p.id = u;
  end if;
end $$;

-- Cross-customer beneficiaries resolve to internal ACME accounts.
create or replace function private.demo_link_internal()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ol uuid; ma uuid; pr uuid; et uuid;
begin
  select id into ol from public.profiles where persona = 'salaried' and is_demo;
  select id into ma from public.profiles where persona = 'freelancer' and is_demo;
  select id into pr from public.profiles where persona = 'business' and is_demo;
  select id into et from public.profiles where persona = 'newcomer' and is_demo;
  if ol is not null and ma is not null then
    insert into public.beneficiaries (owner_id, name, account_number, routing_number, nickname)
    select ol, 'Marcus Reed', a.account_number, a.routing_number, 'p2p' from public.accounts a where a.id = private.persona_checking('freelancer');
    insert into public.beneficiaries (owner_id, name, account_number, routing_number, nickname)
    select ma, 'Olivia Bennett', a.account_number, a.routing_number, 'p2p' from public.accounts a where a.id = private.persona_checking('salaried');
  end if;
  if pr is not null and ol is not null then
    insert into public.beneficiaries (owner_id, name, account_number, routing_number)
    select pr, 'Olivia Bennett (catering)', a.account_number, a.routing_number from public.accounts a where a.id = private.persona_checking('salaried');
  end if;
  if et is not null and ol is not null then
    insert into public.beneficiaries (owner_id, name, account_number, routing_number, is_favorite)
    select et, 'Olivia Bennett', a.account_number, a.routing_number, true from public.accounts a where a.id = private.persona_checking('salaried');
  end if;
end $$;

create or replace function private.demo_ticket(p_customer uuid, p_staff uuid, p_subject text, p_category text,
  p_status public.ticket_status, p_priority public.ticket_priority, p_messages text[], p_internal text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  i int;
begin
  if p_customer is null then return null; end if;
  insert into public.support_tickets (customer_id, subject, category, status, priority, created_at, updated_at)
  values (p_customer, p_subject, p_category, 'open', p_priority, public.sim_now() - interval '2 days', public.sim_now())
  returning id into v_id;
  for i in 1 .. coalesce(array_length(p_messages, 1), 0) loop
    insert into public.ticket_messages (ticket_id, author_id, body, created_at)
    values (v_id, case when i % 2 = 1 then p_customer else p_staff end, p_messages[i],
            public.sim_now() - make_interval(hours => (array_length(p_messages, 1) - i + 1) * 5));
  end loop;
  if p_internal is not null and p_staff is not null then
    insert into public.ticket_messages (ticket_id, author_id, body, is_internal) values (v_id, p_staff, p_internal, true);
  end if;
  update public.support_tickets set status = p_status, assigned_to = case when p_staff is not null and array_length(p_messages, 1) > 1 then p_staff end
  where id = v_id;
  return v_id;
end $$;

create or replace function public.sim_reset_demo()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_start date;
  v_today date;
  v_day date;
  v_staff uuid;
  u_ol uuid; u_ma uuid; u_so uuid; u_ja uuid; u_pr uuid; u_et uuid;
  v_avail bigint;
  v_acc uuid;
  v_txns int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  -- 1. Wipe banking data (profiles and auth users are kept)
  delete from public.sim_events where true;
  delete from public.notifications where true;
  delete from public.ticket_messages where true;
  delete from public.support_tickets where true;
  delete from public.account_applications where true;
  delete from public.ledger_entries where true;
  delete from public.transactions where true;
  delete from public.scheduled_payments where true;
  delete from public.cards where true;
  delete from public.beneficiaries where true;
  delete from public.accounts where not is_system;
  update public.accounts set balance_cents = 0, pending_debits_cents = 0 where is_system;
  update public.profiles set kyc_status = 'not_started' where role = 'customer' and not is_demo;
  update public.sim_state set scenario = 'baseline', flags = '{}'::jsonb, auto_activity = true where id = 1;

  perform setseed(0.2026);

  -- 2. Start the clock 61 days ago and open the demo accounts
  v_today := private.local_date(now());
  v_start := v_today - 61;
  perform private.set_clock(private.local_ts(v_start, '09:00'));
  perform private.demo_provision('salaried', v_start);
  perform private.demo_provision('freelancer', v_start);
  perform private.demo_provision('student', v_start);
  perform private.demo_provision('affluent', v_start);
  perform private.demo_provision('business', v_start);
  perform private.demo_link_internal();

  -- 3. Replay each day up to yesterday
  v_day := v_start + 1;
  while v_day < v_today loop
    if v_day = v_start + 40 then
      perform private.set_clock(private.local_ts(v_day, '05:00'));
      perform private.demo_provision('newcomer', v_day);
      perform private.demo_link_internal_newcomer();
    end if;
    perform private.sim_process_day(v_day, true);
    v_day := v_day + 1;
  end loop;

  -- 4. Back to real time; create today's in-flight items
  perform private.set_clock(now());
  perform private.settle_due();

  select id into u_ol from public.profiles where persona = 'salaried' and is_demo;
  select id into u_ma from public.profiles where persona = 'freelancer' and is_demo;
  select id into u_so from public.profiles where persona = 'student' and is_demo;
  select id into u_ja from public.profiles where persona = 'affluent' and is_demo;
  select id into u_pr from public.profiles where persona = 'business' and is_demo;
  select id into u_et from public.profiles where persona = 'newcomer' and is_demo;
  select id into v_staff from public.profiles where role = 'support' order by created_at limit 1;

  if u_ma is not null then
    perform private.do_transfer(u_ma, private.persona_checking('freelancer'), 45000, 'ach', null,
      private.persona_beneficiary('freelancer', 'Daniel Reed'), 'Shared rent for the cabin trip', null, 'transfer', null, false);
  end if;
  if u_pr is not null then
    perform private.do_transfer(u_pr, private.persona_checking('business'), 320000, 'wire', null,
      private.persona_beneficiary('business', 'Spice Route Imports'), 'Invoice SR-2288', null, 'transfer', null, false);
  end if;
  if u_ja is not null then
    perform private.do_transfer(u_ja, private.persona_checking('affluent'), 1500000, 'ach', null,
      private.persona_beneficiary('affluent', 'Meridian Brokerage'), 'Year-end investment', null, 'transfer', null, false);
  end if;
  if u_ol is not null then
    perform private.do_deposit(private.persona_checking('salaried'), 25000, 'Mobile check deposit', 'check', 'deposit', 'Income', 'Check #1042');
  end if;
  if u_so is not null then
    v_acc := private.persona_checking('student');
    select available_cents into v_avail from public.accounts where id = v_acc;
    perform private.do_transfer(u_so, v_acc, v_avail + 6000, 'instant', null,
      private.persona_beneficiary('student', 'Maria Alvarez'), 'Paying back Mom', null, 'transfer', null, false);
  end if;

  -- 5. Support tickets
  perform private.demo_ticket(u_so, v_staff, 'Card declined at the bookstore', 'card', 'pending_customer', 'normal',
    array['Hi, my card was declined today at PaperTrail Books even though I thought I had money. Can you check?',
          'Hi Sofia, the purchase was declined because the available balance was lower than the amount. Pending transactions reduce your available balance. Would you like to set up a low-balance alert?']);
  perform private.demo_ticket(u_ma, null, 'When will my ACH transfer arrive?', 'transfer', 'open', 'normal',
    array['I sent $450 to my brother via standard ACH. When will it arrive?']);
  perform private.demo_ticket(u_ja, v_staff, 'Request higher wire limit', 'account', 'resolved', 'low',
    array['Could you raise my daily transfer limit for an upcoming property purchase?',
          'Hello James — your Premier Checking limit is already at the $25,000 maximum for online transfers. For larger amounts we can process a wire in branch.',
          'Understood, thank you.']);
  perform private.demo_ticket(u_pr, v_staff, 'Need statements for my accountant', 'statement', 'pending_customer', 'normal',
    array['My accountant needs the last two months of statements for the Kitchen Operating account.',
          'Hi Priya, you can download CSV or PDF statements for any date range from the Statements page. Let us know if you need anything else!']);
  perform private.demo_ticket(u_ol, v_staff, 'Duplicate charge at Blue Fern Café', 'fraud', 'open', 'high',
    array['I see what looks like two charges from Blue Fern Café on the same day. I only went once.'],
    'Checked card network logs: two separate authorizations ~40 min apart. Ask the customer for the receipt before opening a dispute.');

  -- 6. Keep only recent notifications so inboxes look realistic
  delete from public.notifications where created_at < public.sim_now() - interval '6 days';
  insert into public.notifications (user_id, title, body, kind, link)
  select id, 'Welcome to the ACME Bank demo',
    'Your accounts contain two months of simulated activity. Try a transfer, lock a card or download a statement.',
    'info', '/dashboard'
  from public.profiles where is_demo and role = 'customer';

  update public.sim_state set last_reset_at = now(), updated_at = now() where id = 1;
  select count(*) into v_txns from public.transactions;
  delete from public.sim_events where occurred_at < public.sim_now() - interval '14 days' and type in ('card.purchase', 'deposit.posted', 'deposit.pending');
  perform private.log_event('sim.reset', 'warning',
    'Demo data reset: ' || v_txns || ' transactions generated from ' || to_char(v_start, 'Mon DD, YYYY'), null, null, null,
    jsonb_build_object('transactions', v_txns, 'from', v_start, 'to', v_today));
  return jsonb_build_object('transactions', v_txns, 'from', v_start, 'to', v_today);
end $$;

create or replace function private.demo_link_internal_newcomer()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare et uuid;
begin
  select id into et from public.profiles where persona = 'newcomer' and is_demo;
  if et is null then return; end if;
  insert into public.beneficiaries (owner_id, name, account_number, routing_number, is_favorite)
  select et, 'Olivia Bennett', a.account_number, a.routing_number, true
  from public.accounts a where a.id = private.persona_checking('salaried')
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on all functions in schema private to service_role;

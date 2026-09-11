-- PEAKATHLETE AFFILIATE COMMISSION PORTAL
-- Run this ONCE in the SQL Editor of a NEW Supabase project.
-- This project is intentionally separate from the Progress website.

create extension if not exists pgcrypto;

create type public.app_role as enum ('affiliate','admin');
create type public.affiliate_status as enum ('pending','approved','suspended');
create type public.order_status as enum ('pending','confirmed','cancelled','refunded');
create type public.payout_status as enum ('pending','ready','paid','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'affiliate',
  full_name text not null default '',
  email text,
  mobile_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  affiliate_code text unique not null,
  commission_rate numeric(5,2) not null default 10 check (commission_rate >= 0 and commission_rate <= 100),
  status public.affiliate_status not null default 'pending',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid unique not null references public.affiliates(id) on delete cascade,
  payout_method text not null,
  account_name text not null,
  account_number text not null,
  bank_name text,
  qr_code_path text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  selling_price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  external_order_number text unique not null,
  affiliate_id uuid not null references public.affiliates(id),
  customer_name text,
  order_date date not null,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  final_sale numeric(12,2) not null default 0,
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name_snapshot text not null,
  variant text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id),
  period_start date not null,
  period_end date not null,
  qualified_sales numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  status public.payout_status not null default 'pending',
  payment_method text,
  reference_number text,
  receipt_path text,
  admin_note text,
  paid_at timestamptz,
  processed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  commission_rate numeric(5,2) not null,
  qualified_sale numeric(12,2) not null,
  commission_amount numeric(12,2) not null,
  payout_id uuid references public.payouts(id),
  created_at timestamptz not null default now()
);

create index orders_affiliate_date_idx on public.orders(affiliate_id, order_date desc);
create index commissions_affiliate_payout_idx on public.commissions(affiliate_id, payout_id);
create index payouts_affiliate_created_idx on public.payouts(affiliate_id, created_at desc);

-- Automatically create a basic profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'affiliate',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin check used by RLS and secure RPCs.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Affiliate first-time setup. Commission rate/status cannot be supplied by the client.
create or replace function public.complete_affiliate_onboarding(
  p_full_name text,
  p_mobile_number text,
  p_affiliate_code text,
  p_payout_method text,
  p_account_name text,
  p_account_number text,
  p_bank_name text default null,
  p_qr_code_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_affiliate_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if public.is_admin() then raise exception 'Admin accounts do not use affiliate onboarding'; end if;
  if length(trim(coalesce(p_full_name,''))) < 2 then raise exception 'Full name is required'; end if;
  if length(trim(coalesce(p_affiliate_code,''))) < 3 then raise exception 'Affiliate code must be at least 3 characters'; end if;
  if length(trim(coalesce(p_account_name,''))) < 2 then raise exception 'Account name is required'; end if;
  if length(trim(coalesce(p_account_number,''))) < 5 then raise exception 'Account number is required'; end if;

  update public.profiles
  set full_name = trim(p_full_name), mobile_number = trim(p_mobile_number), updated_at = now()
  where id = v_user_id;

  if exists (select 1 from public.affiliates where user_id = v_user_id) then
    raise exception 'Affiliate onboarding has already been completed';
  end if;

  insert into public.affiliates (user_id, affiliate_code, commission_rate, status)
  values (v_user_id, upper(trim(p_affiliate_code)), 10, 'pending')
  returning id into v_affiliate_id;

  insert into public.payout_accounts (
    affiliate_id, payout_method, account_name, account_number, bank_name, qr_code_path, verified_at
  ) values (
    v_affiliate_id, trim(p_payout_method), trim(p_account_name), trim(p_account_number),
    nullif(trim(coalesce(p_bank_name,'')), ''), p_qr_code_path, null
  )
  on conflict (affiliate_id) do update set
    payout_method = excluded.payout_method,
    account_name = excluded.account_name,
    account_number = excluded.account_number,
    bank_name = excluded.bank_name,
    qr_code_path = excluded.qr_code_path,
    verified_at = null,
    updated_at = now();

  return v_affiliate_id;
exception
  when unique_violation then
    raise exception 'That affiliate code is already in use. Please choose another code.';
end;
$$;

-- Affiliate can safely update payout details. Any payout account change requires re-verification.
create or replace function public.update_my_payout_profile(
  p_full_name text,
  p_mobile_number text,
  p_payout_method text,
  p_account_name text,
  p_account_number text,
  p_bank_name text default null,
  p_qr_code_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_affiliate_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select id into v_affiliate_id from public.affiliates where user_id = v_user_id;
  if v_affiliate_id is null then raise exception 'Affiliate profile not found'; end if;

  update public.profiles
  set full_name = trim(p_full_name), mobile_number = trim(p_mobile_number), updated_at = now()
  where id = v_user_id;

  update public.payout_accounts
  set payout_method = trim(p_payout_method),
      account_name = trim(p_account_name),
      account_number = trim(p_account_number),
      bank_name = nullif(trim(coalesce(p_bank_name,'')), ''),
      qr_code_path = coalesce(p_qr_code_path, qr_code_path),
      verified_at = null,
      updated_at = now()
  where affiliate_id = v_affiliate_id;

  update public.affiliates
  set status = case when status = 'suspended' then status else 'pending' end,
      approved_at = case when status = 'suspended' then approved_at else null end
  where id = v_affiliate_id;
end;
$$;

-- Admin review/approval + commission rate update.
create or replace function public.admin_review_affiliate(
  p_affiliate_id uuid,
  p_status public.affiliate_status,
  p_commission_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_commission_rate < 0 or p_commission_rate > 100 then raise exception 'Invalid commission rate'; end if;

  update public.affiliates
  set status = p_status,
      commission_rate = p_commission_rate,
      approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else null end
  where id = p_affiliate_id;

  if p_status = 'approved' then
    update public.payout_accounts set verified_at = now() where affiliate_id = p_affiliate_id;
  else
    update public.payout_accounts set verified_at = null where affiliate_id = p_affiliate_id;
  end if;
end;
$$;

-- Current athlete application approval flow.
-- Approval is independent of affiliates.commission_rate; product commission is configured separately.
create or replace function public.admin_approve_affiliate_application(
  p_affiliate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  update public.affiliates
  set status = 'approved',
      approved_at = coalesce(approved_at, now())
  where id = p_affiliate_id
    and status = 'pending';

  if not found then raise exception 'Pending athlete application not found'; end if;

  update public.payout_accounts
  set verified_at = now(), updated_at = now()
  where affiliate_id = p_affiliate_id;
end;
$$;

-- Admin enters a manual sale. Confirmed sales automatically create commission using the affiliate's server-side rate.
create or replace function public.admin_create_sale(
  p_affiliate_id uuid,
  p_external_order_number text,
  p_order_date date,
  p_product_name text,
  p_quantity integer,
  p_unit_price numeric,
  p_status public.order_status default 'confirmed',
  p_customer_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_rate numeric(5,2);
  v_total numeric(12,2);
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if p_unit_price < 0 then raise exception 'Unit price cannot be negative'; end if;
  if length(trim(coalesce(p_external_order_number,''))) < 1 then raise exception 'Order number is required'; end if;

  select commission_rate into v_rate from public.affiliates where id = p_affiliate_id;
  if v_rate is null then raise exception 'Affiliate not found'; end if;
  v_total := round((p_quantity * p_unit_price)::numeric, 2);

  insert into public.orders (
    external_order_number, affiliate_id, customer_name, order_date,
    subtotal, discount, final_sale, status
  ) values (
    trim(p_external_order_number), p_affiliate_id, nullif(trim(coalesce(p_customer_name,'')),''), p_order_date,
    v_total, 0, v_total, p_status
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_name_snapshot, quantity, unit_price, line_total
  ) values (
    v_order_id, trim(p_product_name), p_quantity, p_unit_price, v_total
  );

  if p_status = 'confirmed' then
    insert into public.commissions (
      affiliate_id, order_id, commission_rate, qualified_sale, commission_amount
    ) values (
      p_affiliate_id, v_order_id, v_rate, v_total, round(v_total * v_rate / 100.0, 2)
    );
  end if;

  return v_order_id;
end;
$$;

-- Safely change order status. Unpaid commissions follow confirmed/refunded/cancelled status.
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status public.order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_sale numeric(12,2);
  v_rate numeric(5,2);
  v_existing_payout uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select o.affiliate_id, o.final_sale, a.commission_rate
  into v_affiliate_id, v_sale, v_rate
  from public.orders o join public.affiliates a on a.id = o.affiliate_id
  where o.id = p_order_id;

  if v_affiliate_id is null then raise exception 'Order not found'; end if;
  select payout_id into v_existing_payout from public.commissions where order_id = p_order_id;
  if v_existing_payout is not null and p_status <> 'confirmed' then
    raise exception 'This commission is already in a payout batch and cannot be reversed here';
  end if;

  update public.orders set status = p_status where id = p_order_id;

  if p_status = 'confirmed' then
    insert into public.commissions (affiliate_id, order_id, commission_rate, qualified_sale, commission_amount)
    values (v_affiliate_id, p_order_id, v_rate, v_sale, round(v_sale * v_rate / 100.0, 2))
    on conflict (order_id) do update set
      commission_rate = excluded.commission_rate,
      qualified_sale = excluded.qualified_sale,
      commission_amount = excluded.commission_amount;
  else
    delete from public.commissions where order_id = p_order_id and payout_id is null;
  end if;
end;
$$;

-- Create one payout batch from confirmed commissions that have never been assigned to a payout.
create or replace function public.admin_create_payout(
  p_affiliate_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout_id uuid;
  v_sales numeric(12,2);
  v_commission numeric(12,2);
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_period_end < p_period_start then raise exception 'Invalid payout period'; end if;

  select coalesce(sum(c.qualified_sale),0), coalesce(sum(c.commission_amount),0)
  into v_sales, v_commission
  from public.commissions c
  join public.orders o on o.id = c.order_id
  where c.affiliate_id = p_affiliate_id
    and c.payout_id is null
    and o.status = 'confirmed'
    and o.order_date between p_period_start and p_period_end;

  if v_commission <= 0 then raise exception 'No unpaid confirmed commissions found in this period'; end if;

  insert into public.payouts (
    affiliate_id, period_start, period_end, qualified_sales, commission_amount, status
  ) values (
    p_affiliate_id, p_period_start, p_period_end, v_sales, v_commission, 'ready'
  ) returning id into v_payout_id;

  update public.commissions c
  set payout_id = v_payout_id
  from public.orders o
  where c.order_id = o.id
    and c.affiliate_id = p_affiliate_id
    and c.payout_id is null
    and o.status = 'confirmed'
    and o.order_date between p_period_start and p_period_end;

  return v_payout_id;
end;
$$;

-- Mark a ready payout as paid. The database records the admin identity and timestamp.
create or replace function public.admin_mark_payout_paid(
  p_payout_id uuid,
  p_payment_method text,
  p_reference_number text,
  p_receipt_path text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if length(trim(coalesce(p_payment_method,''))) < 2 then raise exception 'Payment method is required'; end if;
  if length(trim(coalesce(p_reference_number,''))) < 2 then raise exception 'Reference number is required'; end if;
  if length(trim(coalesce(p_receipt_path,''))) < 2 then raise exception 'Payment receipt is required'; end if;

  update public.payouts
  set status = 'paid',
      payment_method = trim(p_payment_method),
      reference_number = trim(p_reference_number),
      receipt_path = trim(p_receipt_path),
      admin_note = nullif(trim(coalesce(p_admin_note,'')), ''),
      paid_at = now(),
      processed_by = auth.uid()
  where id = p_payout_id and status = 'ready';

  if not found then
    raise exception 'Payout was not found or has already been processed';
  end if;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.affiliates enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.commissions enable row level security;
alter table public.payouts enable row level security;

create policy "profile self or admin read" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

create policy "affiliate self or admin read" on public.affiliates
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admin manages affiliates" on public.affiliates
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "payout account owner or admin read" on public.payout_accounts
for select to authenticated using (
  public.is_admin() or affiliate_id in (select id from public.affiliates where user_id = auth.uid())
);
create policy "admin manages payout accounts" on public.payout_accounts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read products" on public.products
for select to authenticated using (true);
create policy "admin manages products" on public.products
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "affiliate own orders or admin read" on public.orders
for select to authenticated using (
  public.is_admin() or affiliate_id in (select id from public.affiliates where user_id = auth.uid())
);
create policy "admin manages orders" on public.orders
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "affiliate own order items or admin read" on public.order_items
for select to authenticated using (
  public.is_admin() or exists (
    select 1 from public.orders o
    join public.affiliates a on a.id = o.affiliate_id
    where o.id = order_items.order_id and a.user_id = auth.uid()
  )
);
create policy "admin manages order items" on public.order_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "affiliate own commissions or admin read" on public.commissions
for select to authenticated using (
  public.is_admin() or affiliate_id in (select id from public.affiliates where user_id = auth.uid())
);
create policy "admin manages commissions" on public.commissions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "affiliate own payouts or admin read" on public.payouts
for select to authenticated using (
  public.is_admin() or affiliate_id in (select id from public.affiliates where user_id = auth.uid())
);
create policy "admin manages payouts" on public.payouts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private Storage buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('affiliate-qr', 'affiliate-qr', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payout-receipts', 'payout-receipts', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- QR: owner can manage files only inside their auth-user folder; admins can read all.
create policy "users upload own qr" on storage.objects
for insert to authenticated with check (
  bucket_id = 'affiliate-qr' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users read own qr" on storage.objects
for select to authenticated using (
  bucket_id = 'affiliate-qr' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy "users update own qr" on storage.objects
for update to authenticated using (
  bucket_id = 'affiliate-qr' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'affiliate-qr' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "users delete own qr" on storage.objects
for delete to authenticated using (
  bucket_id = 'affiliate-qr' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Receipts: only admins upload; affiliate can read receipts stored under their user-id folder.
create policy "admins upload payout receipts" on storage.objects
for insert to authenticated with check (
  bucket_id = 'payout-receipts' and public.is_admin()
);
create policy "receipt owner or admin read" on storage.objects
for select to authenticated using (
  bucket_id = 'payout-receipts' and (
    public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
  )
);
create policy "admins update payout receipts" on storage.objects
for update to authenticated using (bucket_id = 'payout-receipts' and public.is_admin())
with check (bucket_id = 'payout-receipts' and public.is_admin());
create policy "admins delete payout receipts" on storage.objects
for delete to authenticated using (bucket_id = 'payout-receipts' and public.is_admin());

-- Restrict RPC execution.
revoke all on function public.complete_affiliate_onboarding(text,text,text,text,text,text,text,text) from public, anon;
revoke all on function public.update_my_payout_profile(text,text,text,text,text,text,text) from public, anon;
revoke all on function public.admin_review_affiliate(uuid,public.affiliate_status,numeric) from public, anon;
revoke all on function public.admin_approve_affiliate_application(uuid) from public, anon;
revoke all on function public.admin_create_sale(uuid,text,date,text,integer,numeric,public.order_status,text) from public, anon;
revoke all on function public.admin_update_order_status(uuid,public.order_status) from public, anon;
revoke all on function public.admin_create_payout(uuid,date,date) from public, anon;
revoke all on function public.admin_mark_payout_paid(uuid,text,text,text,text) from public, anon;

grant execute on function public.complete_affiliate_onboarding(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.update_my_payout_profile(text,text,text,text,text,text,text) to authenticated;
grant execute on function public.admin_review_affiliate(uuid,public.affiliate_status,numeric) to authenticated;
grant execute on function public.admin_approve_affiliate_application(uuid) to authenticated;
grant execute on function public.admin_create_sale(uuid,text,date,text,integer,numeric,public.order_status,text) to authenticated;
grant execute on function public.admin_update_order_status(uuid,public.order_status) to authenticated;
grant execute on function public.admin_create_payout(uuid,date,date) to authenticated;
grant execute on function public.admin_mark_payout_paid(uuid,text,text,text,text) to authenticated;

-- IMPORTANT: Create your first admin account by signing up normally, then run this in SQL Editor:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL@example.com';

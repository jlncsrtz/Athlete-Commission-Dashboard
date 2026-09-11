-- PEAKATHLETE: athlete application approval RPC
-- SAFE FOR AN EXISTING PROJECT. Run this file in Supabase SQL Editor.
-- This approval does NOT read, validate, or update affiliates.commission_rate.

create or replace function public.admin_approve_affiliate_application(
  p_affiliate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.affiliates
  set status = 'approved',
      approved_at = coalesce(approved_at, now())
  where id = p_affiliate_id
    and status = 'pending';

  if not found then
    raise exception 'Pending athlete application not found';
  end if;

  update public.payout_accounts
  set verified_at = now(),
      updated_at = now()
  where affiliate_id = p_affiliate_id;
end;
$$;

revoke all on function public.admin_approve_affiliate_application(uuid) from public, anon;
grant execute on function public.admin_approve_affiliate_application(uuid) to authenticated;

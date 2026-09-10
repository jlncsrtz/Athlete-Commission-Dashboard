# Peakathlete Affiliate Commission Portal

A standalone React + Vite + Supabase affiliate portal. This project is **not connected to the Progress website**.

## What is real in this build

- Supabase email/password authentication
- Affiliate first-login payout onboarding
- Private QR-code upload to Supabase Storage
- Admin approval / suspension and per-affiliate commission rate
- Manual Enstack order entry by admin
- Server-side commission calculation
- Confirmed / pending / cancelled / refunded order status
- Affiliate sales + commission dashboard
- Payout batch creation from confirmed, unpaid commissions only
- Prevention of the same commission being included in multiple payout batches
- Admin payment reference + private receipt upload
- Affiliate view of paid status, reference number, and payment receipt
- Row Level Security (RLS) so affiliates only read their own financial data


## Branding / logo

A default Peakathlete-style `P` mark is already included at:

```text
public/peakathlete-logo.svg
```

If you have the official logo, replace that file with your real SVG (keeping the same filename), or change the `src` in `BrandMark` inside `src/main.jsx`. The login page, onboarding screen, and dashboard sidebar all use the same logo component.

## 1. Create a NEW Supabase project

Do not reuse the Progress website Supabase project.

In the new Supabase dashboard, open **SQL Editor**, paste the full contents of `supabase-schema.sql`, then run it once.

This creates the database tables, RLS policies, RPC functions, and two private Storage buckets:

- `affiliate-qr`
- `payout-receipts`

## 2. Add `.env`

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then add the values from your NEW Supabase project:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

For older Supabase projects, `VITE_SUPABASE_ANON_KEY` is also supported by the code.

Never put the service-role key, database password, SMTP password, OTP, or other private server secrets in this frontend `.env`.

## 3. Install and run

```bash
npm install
npm run dev
```

## 4. Create the first admin

Create/sign up an account using the email you want for the owner/admin. Then in Supabase SQL Editor run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL@example.com';
```

Sign out and sign back in. That account will now automatically open the Admin Portal.

All normal public signups remain `affiliate` accounts. The frontend cannot turn itself into an admin.

## 5. Affiliate flow

1. Affiliate creates an account.
2. Affiliate signs in.
3. First-time setup asks for full name, mobile, affiliate code, payout method, account name/number, bank name if applicable, and QR image.
4. Account is `pending`.
5. Admin opens **Affiliates > Review**, sets the commission rate, and approves the account.
6. Admin manually records Enstack affiliate sales under **Orders > Add sale**.
7. Confirmed orders automatically create commission using the server-side commission rate.
8. Affiliate sees their sales and earnings immediately.

## 6. Payout flow

1. Admin opens **Affiliates** and clicks **Create payout**.
2. Pick the payout period.
3. Only confirmed commissions that are not already attached to a payout are included.
4. The batch appears in **Payouts** as `Ready`.
5. After sending GCash/bank payment, click **Pay**.
6. Enter payment method and reference number, upload receipt, then confirm.
7. Affiliate sees `Paid`, the payment reference, and can open the private receipt.

## 7. Enstack

This version supports **manual Enstack order entry**, because this portal does not assume Enstack exposes an affiliate API.

A future upgrade can add CSV import if you export your Enstack orders into CSV/Excel.

## 8. Vercel

Create a **new Vercel project** for this repository/folder. Add the same two public Supabase environment variables in Vercel Project Settings > Environment Variables, then deploy.

Recommended separate hostname:

- `affiliates.peakathlete.com`
- or a separate `*.vercel.app` project URL

## Security notes

- Affiliates cannot read other affiliates' orders, commissions, payout accounts, or receipts.
- Commission percentage is calculated on the database side, not trusted from the browser.
- QR codes and receipts are in private buckets and opened using short-lived signed URLs.
- Changing payout details resets the account to pending verification (unless suspended).
- Commissions already placed in a payout batch cannot be silently reversed through the normal order-status flow.

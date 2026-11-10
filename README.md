# ACME Bank

A realistic, fully working **simulated digital bank** built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui and Supabase (PostgreSQL, Auth, Storage and Realtime). External rails (ACH, wires, card networks, identity checks) are simulated inside the database, and everything is persisted.

> ACME Bank is a demo. No real money moves and no real personal data should be entered.

---

## Features

**Customers**

- Sign up, sign in, password recovery (email link), profile with avatar upload (Supabase Storage), settings (alerts, theme, password).
- **Account opening** wizard with simulated KYC (instant approval, or manual review by staff).
- **Overview**: total and available balance, 60-day balance chart, spending by category, upcoming and pending items.
- **Accounts & activity**: search and filter by account, direction, status, type, category and date; per-account **ledger** with debit/credit columns and running balance; daily transfer limit; simulated deposits (cash, wire, ACH, check).
- **Transfers**: between your own accounts, to ACME customers (instant, free) or other banks via ACH / Instant / Wire. **Fees, total, ETA and remaining limit are shown before confirming**. Large transfers ($10,000+) are held for review. Pending transfers can be cancelled.
- **Beneficiaries** (ACME accounts are auto-detected), **scheduled payments** (one-time, weekly, every 2 weeks, monthly; pause/resume/cancel/pay now).
- **Cards**: lock/unlock, daily/monthly limits, online/contactless/international toggles, replacement (fee shown), simulated purchases with real authorization rules.
- **Statements**: any date range, preview + download as **PDF** or **CSV**.
- **Support**: tickets with conversation thread and file attachments.
- Real-time notifications (toasts + bell) via Supabase Realtime.

**Staff (support + admin)**

- Operations overview, customer search and 360° view (freeze/unfreeze accounts, lock cards, simulate deposits, download statements).
- Review queue: approve/reject held transfers and pending account applications.
- Ticket desk with status/priority/assignee and internal notes.
- Event log with filters.
- **Admin only**: **Simulation lab** (advance the clock 1/3/7/30 days, run scenarios, process due items, toggle automatic activity, **reset demo data**) and **Users & roles**.

Navigation adapts to the role: customers see banking screens, support sees operations, admins also see administration. Desktop uses a side menu; mobile uses a bottom navigation bar with a "More" sheet.

### Money & ledger model

- All amounts are **integer cents** (`bigint`).
- Every posted transaction writes **balanced double-entry lines** in `ledger_entries` (customer account ↔ bank system accounts: external clearing, card network, fee income, interest expense). The sum of all ledger lines is always zero.
- `accounts.available_cents = balance_cents − pending_debits_cents`. Pending debits (ACH, wires, held reviews) place a **hold** until they settle or are cancelled.
- Declines (insufficient funds, locked card, limits) are recorded as `failed` transactions with a reason, and appear in history.
- Banking operations run in `SECURITY DEFINER` Postgres functions (atomic, row-locked). The `private` schema is not exposed by the API; clients only call validated `public` RPCs. RLS protects every table.

### Simulation

A single simulated clock (`sim_now()`) drives the bank. Advancing a day: month-end interest and maintenance fees → settlement of due ACH/wire/check items → scheduled payments → generated customer activity (payroll, purchases, P2P transfers).

Scenarios (Simulation lab): **Baseline**, **Payday**, **Pending transfers**, **Insufficient funds**, **Shopping spree**, **Fraud alert**, **ACH network delay**, **Manual KYC review**.

### Demo data

Six customers with two months of history (~600 transactions), plus a support agent and an admin. Password for all: `AcmeDemo!2026` (configurable with `DEMO_PASSWORD`).

| Email | Role | Persona |
| --- | --- | --- |
| olivia.bennett@acmebank.test | customer | Salaried, checking + savings, rent & bills |
| marcus.reed@acmebank.test | customer | Freelancer, irregular income |
| sofia.alvarez@acmebank.test | customer | Student, low balance, declines |
| james.carter@acmebank.test | customer | Premier client, large transfers in review |
| priya.natarajan@acmebank.test | customer | Restaurant owner, suppliers and wires |
| ethan.walker@acmebank.test | customer | New customer (opened 3 weeks ago) |
| support@acmebank.test | support | Support agent |
| admin@acmebank.test | admin | Administrator / simulation lab |

The sign-in page has a **Demo accounts** panel that fills these in.

---

## Project structure

```
src/
  app/                    Screens (App Router)
    (auth)/               login, signup, forgot-password, reset-password
    (app)/                Authenticated shell (sidebar + bottom nav, realtime)
      (customer)/         dashboard, accounts, transfers, beneficiaries, payments, cards, statements, support
      staff/              overview, customers, reviews, tickets, events, simulation (admin), users (admin)
      open-account/ profile/ settings/ home/
    api/                  REST API: health, statements, v1/accounts, v1/transfers
    auth/                 email-link confirmation + sign-out route handlers
  actions/                Server Actions (zod validation → services)
  services/               Business services / data access (server-only)
  components/             ui/ (shadcn), layout/, banking/, account/, support/, staff/, common/
  lib/                    Supabase clients (server, browser, admin, proxy), formatting, types
  proxy.ts                Session refresh + auth redirects (Next.js 16 "proxy", formerly middleware)
supabase/
  migrations/             Schema, RLS/storage/realtime, banking engine, simulation engine
  config.toml             Local stack config (ports 55421–55429)
scripts/seed.ts           Creates demo users and generates demo data
```

---

## Run locally

Requirements: Node.js 20+ (22 recommended), pnpm 10, Docker Desktop (for the local Supabase stack).

```bash
pnpm install
```

```bash
pnpm exec supabase start
```

`supabase start` prints the API URL and keys. Copy the example env file and fill in the **publishable** and **secret** keys:

```bash
cp .env.example .env.local
```

Apply migrations and seed demo data:

```bash
pnpm db:reset
```

(`db:reset` = `supabase db reset` + `pnpm db:seed`. Use `pnpm db:seed` alone to regenerate data without dropping the schema.)

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000. Local emails (password reset, confirmations) are delivered to **Mailpit** at http://127.0.0.1:55424. Supabase Studio: http://127.0.0.1:55423.

Other scripts: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:types` (regenerates `src/lib/supabase/database.types.ts`).

> This project uses non-default local ports (5542x) so it can run next to other Supabase projects.

---

## Deploy to Vercel (web app + API)

The web app and the REST API are the same Next.js project: pages, Server Actions and the route handlers under `/api/*` are deployed together as Vercel Functions. One Vercel project serves both `https://<app>.vercel.app` and `https://<app>.vercel.app/api/...`.

### 1. Create the Supabase project

1. Create a project at https://supabase.com/dashboard.
2. Link and push the schema:

   ```bash
   pnpm exec supabase login
   ```

   ```bash
   pnpm exec supabase link --project-ref <your-project-ref>
   ```

   ```bash
   pnpm exec supabase db push
   ```

3. In **Authentication › URL Configuration** set **Site URL** to your Vercel URL and add `https://<your-app>.vercel.app/**` to **Redirect URLs** (keep `http://localhost:3000/**` for local dev).
4. Optional: in **Authentication › Providers › Email** decide whether to require email confirmation (the app supports both).
5. Seed demo data against the hosted project (uses the secret key, run from your machine):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<sb_secret_...> pnpm db:seed
   ```

### 2. Create the Vercel project

1. Push this repository to GitHub/GitLab/Bitbucket and import it at https://vercel.com/new (framework preset **Next.js**, install command `pnpm install`, build command `pnpm build` — both auto-detected).
2. Add **Environment Variables** (Production and Preview):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (Project Settings › API Keys) |
   | `SUPABASE_SECRET_KEY` | `sb_secret_...` — server only, required for the admin **Reset demo data** action |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` (used in password-reset links) |
   | `DEMO_PASSWORD` | Password for demo users (optional, default `AcmeDemo!2026`) |

3. Deploy. Or with the CLI:

   ```bash
   pnpm dlx vercel@latest
   ```

   ```bash
   pnpm dlx vercel@latest --prod
   ```

4. Check `https://<your-app>.vercel.app/api/health` returns `{"status":"ok"}`.

---

## REST API

Authenticate with the web session cookie or `Authorization: Bearer <Supabase access token>` (obtain one with `supabase.auth.signInWithPassword`). Amounts are integer cents.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check (database reachability) |
| GET | `/api/v1/accounts` | Caller's accounts and balances |
| GET | `/api/v1/accounts/:id/transactions?q=&status=&from=&to=&page=&page_size=` | Account activity |
| POST | `/api/v1/transfers` | Create a transfer, or quote it with `"dry_run": true`. Supports `Idempotency-Key` header |
| GET | `/api/statements?account=&from=YYYY-MM-DD&to=YYYY-MM-DD&format=pdf\|csv` | Statement download |

Example:

```bash
curl -X POST https://<app>/api/v1/transfers -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: 7f1c" -d '{"from_account_id":"<uuid>","beneficiary_id":"<uuid>","amount_cents":12500,"rail":"instant"}'
```

Responses: `201` created (`status` `posted` or `pending`), `402` declined (insufficient funds), `400` business rule error (e.g. daily limit), `422` invalid body, `401` unauthenticated.

---

## Fees (seeded in `fee_schedule`)

| Fee | Amount |
| --- | --- |
| ACME-to-ACME transfer, standard ACH, bill payment | Free |
| Instant transfer | 1.5% (min $0.50, max $15.00) |
| Domestic wire | $25.00 |
| Foreign card transaction | 3% |
| Card replacement | $5.00 |
| Monthly maintenance (checking) | $12.00, waived with a $1,500+ balance |

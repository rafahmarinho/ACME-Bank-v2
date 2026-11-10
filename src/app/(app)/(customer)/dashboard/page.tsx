import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, CalendarClock, CreditCard, FileText, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { requireCustomer, getSimNow } from "@/services/session";
import { getActivity, getBalanceSeries, getMonthFlows, getSpendingByCategory, listAccounts } from "@/services/accounts";
import { listScheduledPayments } from "@/services/payments";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Money, StatCard, StatusBadge } from "@/components/common/display";
import { ActivityList } from "@/components/banking/activity-list";
import { BalanceChart, SpendingChart } from "@/components/banking/charts";
import { formatCents, formatPlainDate, localIsoDate, localMidnightUtc, maskAccount } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { supabase, profile, userId } = await requireCustomer();
  const sp = await searchParams;
  const now = await getSimNow();
  const accounts = await listAccounts(supabase, userId);
  const ids = accounts.map((a) => a.id);
  const today = localIsoDate(now);
  const monthStart = localMidnightUtc(`${today.slice(0, 8)}01`).toISOString();

  const [series, spending, flows, activity, pending, schedules] = await Promise.all([
    getBalanceSeries(supabase, accounts, 60, now),
    getSpendingByCategory(supabase, ids, monthStart),
    getMonthFlows(supabase, ids, monthStart),
    getActivity(supabase, { accountIds: ids, pageSize: 8 }),
    getActivity(supabase, { accountIds: ids, status: "pending", pageSize: 5 }),
    listScheduledPayments(supabase, userId),
  ]);

  const total = accounts.reduce((s, a) => s + a.balance_cents, 0);
  const available = accounts.reduce((s, a) => s + (a.available_cents ?? 0), 0);
  const upcoming = schedules.filter((s) => s.status === "active").slice(0, 4);
  const first = profile.full_name.split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date(now)));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const names = Object.fromEntries(accounts.map((a) => [a.id, a.nickname]));

  return (
    <div className="space-y-6">
      {sp.password === "updated" && (
        <p className="rounded-lg border border-success/30 bg-success/8 px-4 py-2 text-sm text-success">Your password was updated.</p>
      )}
      <section className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-sidebar-foreground sm:p-8">
        <div aria-hidden className="absolute -top-24 -right-20 size-80 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, var(--orange-500), transparent 65%)" }} />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-sidebar-foreground/70">{greeting}, {first}</p>
            <p className="mt-3 text-xs tracking-wider text-sidebar-foreground/60 uppercase">Total balance</p>
            <p className="text-4xl font-semibold tracking-tight text-white tabular">{formatCents(total)}</p>
            <p className="mt-1 text-sm text-sidebar-foreground/70">
              Available <span className="font-medium text-white tabular">{formatCents(available)}</span>
              {total !== available && <> · {formatCents(total - available)} on hold</>}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { href: "/transfers", icon: ArrowLeftRight, label: "Transfer" },
              { href: "/payments", icon: CalendarClock, label: "Pay bills" },
              { href: "/cards", icon: CreditCard, label: "Cards" },
              { href: "/statements", icon: FileText, label: "Statements" },
            ].map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-xl bg-sidebar-accent/70 px-3 py-3 text-xs font-medium text-white transition hover:bg-sidebar-accent">
                <Icon className="size-5 text-brand" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Money in this month" value={formatCents(flows.income)} icon={TrendingUp} hint="Deposits, payroll and interest" />
        <StatCard label="Money out this month" value={formatCents(flows.spending)} icon={TrendingDown} hint="Purchases, bills and fees" />
        <StatCard label="Pending" value={pending.total} icon={CalendarClock} accent={pending.total > 0} hint="Transactions awaiting settlement" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Balance over time</CardTitle>
            <CardDescription>All accounts · last 60 days</CardDescription>
          </CardHeader>
          <CardContent>
            <BalanceChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Spending this month</CardTitle>
            <CardDescription>By category</CardDescription>
          </CardHeader>
          <CardContent>
            {spending.length ? <SpendingChart data={spending} /> : <EmptyState title="No spending yet" description="Card purchases and bills will appear here." />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Your accounts</h2>
              <Link href="/accounts" className="text-sm font-medium text-primary hover:underline dark:text-brand">Manage</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map((a) => (
                <Link key={a.id} href={`/accounts/${a.id}`} className="group rounded-xl border bg-card p-4 transition hover:border-brand/50 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {a.type === "savings" ? <PiggyBank className="size-4 text-brand" /> : <Wallet className="size-4 text-brand" />}
                      {a.nickname}
                    </span>
                    {a.status !== "active" ? <StatusBadge status={a.status} /> : <span className="text-xs text-muted-foreground">{maskAccount(a.account_number)}</span>}
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular">{formatCents(a.balance_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    Available {formatCents(a.available_cents)}
                    {a.type === "savings" && a.interest_rate_bps > 0 && ` · ${(a.interest_rate_bps / 100).toFixed(2)}% APY`}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent activity</h2>
              <Link href="/accounts" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline dark:text-brand">
                See all <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {activity.rows.length ? <ActivityList rows={activity.rows} accountNames={accounts.length > 1 ? names : undefined} /> : <EmptyState title="No transactions yet" />}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming payments</CardTitle>
              <CardAction>
                <Link href="/payments" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>View</Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scheduled payments.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {upcoming.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.description}</span>
                        <span className="block text-xs text-muted-foreground">{formatPlainDate(s.next_run_date)} · {s.frequency}</span>
                      </span>
                      <Money cents={s.amount_cents} className="font-medium" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {pending.rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending</CardTitle>
                <CardDescription>Will settle when the clearing window passes</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {pending.rows.map((r) => (
                    <li key={`${r.id}-${r.account_id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.description}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.requires_review ? "Under review" : `Expected ${formatPlainDate(r.settles_at ? localIsoDate(r.settles_at) : null)}`}
                        </span>
                      </span>
                      <Money cents={r.signed_amount_cents} sign colored className="font-medium" />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

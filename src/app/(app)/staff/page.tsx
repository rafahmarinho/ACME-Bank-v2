import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Clock, Landmark, MessagesSquare, Users, Wallet, Zap } from "lucide-react";
import { getSimNow, requireStaff } from "@/services/session";
import { getStaffOverview, listPendingSettlements } from "@/services/staff";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/common/display";
import { EventList } from "@/components/staff/event-list";
import { formatCents, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Staff overview" };

export default async function StaffHome() {
  const { supabase, profile } = await requireStaff();
  const now = await getSimNow();
  const [o, pending] = await Promise.all([getStaffOverview(supabase, now), listPendingSettlements(supabase)]);

  return (
    <div>
      <PageHeader
        eyebrow="ACME Bank operations"
        title={`Hello, ${profile.full_name.split(" ")[0]}`}
        description="Monitor customers, reviews, support and the simulated payment network."
        actions={
          profile.role === "admin" ? (
            <Link href="/staff/simulation" className={buttonVariants({ className: "bg-brand text-brand-foreground hover:bg-brand/90" })}>
              <Zap /> Simulation lab
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verified customers" value={o.customers} icon={Users} hint={`${o.accounts} accounts · ${o.frozen} frozen`} />
        <StatCard label="Total deposits" value={formatCents(o.deposits)} icon={Landmark} hint="Sum of customer balances" />
        <StatCard label="Posted today" value={formatCents(o.volumeToday)} icon={Wallet} hint={`${o.failedToday} declined / failed today`} />
        <StatCard label="Pending settlement" value={o.pending} icon={Clock} hint="ACH, wires and check deposits" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Link href="/staff/reviews">
          <StatCard label="Transfers in review" value={o.reviews} icon={AlertTriangle} accent={o.reviews > 0} hint="$10,000+ outgoing transfers" />
        </Link>
        <Link href="/staff/reviews">
          <StatCard label="Applications to verify" value={o.applications} icon={ClipboardCheck} accent={o.applications > 0} hint="Manual KYC queue" />
        </Link>
        <Link href="/staff/tickets">
          <StatCard label="Open tickets" value={o.openTickets} icon={MessagesSquare} accent={o.openTickets > 0} hint="Open or awaiting customer" />
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest events</CardTitle>
            <CardAction>
              <Link href="/staff/events" className={buttonVariants({ variant: "ghost", size: "sm" })}>View log</Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <EventList events={o.events} compact />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Awaiting settlement</CardTitle>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              <ul className="divide-y text-sm">
                {pending.slice(0, 10).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{t.description}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t.account?.owner?.full_name} · {t.rail?.toUpperCase() ?? t.kind} · settles {formatShortDate(t.settles_at)}
                      </span>
                    </span>
                    <span className={t.direction === "credit" ? "font-medium text-success tabular" : "font-medium tabular"}>
                      {formatCents(t.direction === "credit" ? t.amount_cents : -(t.amount_cents + t.fee_cents), { sign: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Lock, LockOpen, Snowflake, Sun } from "lucide-react";
import { getSimNow, requireStaff } from "@/services/session";
import { getCustomer } from "@/services/staff";
import { getActivity } from "@/services/accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DefinitionList, PageHeader, StatusBadge } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { ActivityList } from "@/components/banking/activity-list";
import { DepositForm } from "@/components/banking/account-forms";
import { setAccountStatusAction, staffCardLockAction } from "@/actions/staff";
import { addDays, formatCents, formatDate, formatDateTime, localIsoDate } from "@/lib/format";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: PageProps<"/staff/customers/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const c = await getCustomer(supabase, id);
  if (!c.profile) notFound();
  const now = await getSimNow();
  const today = localIsoDate(now);
  const activity = await getActivity(supabase, { accountIds: c.accounts.map((a) => a.id), pageSize: 15 });
  const names = Object.fromEntries(c.accounts.map((a) => [a.id, a.nickname]));
  const p = c.profile;

  return (
    <div>
      <Link href="/staff/customers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Customers
      </Link>
      <PageHeader
        eyebrow={p.customer_number ?? "No customer number"}
        title={p.full_name}
        description={<>{p.email} · <StatusBadge status={p.kyc_status} /></>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {c.accounts.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {a.nickname} <span className="font-mono text-xs text-muted-foreground">{a.account_number}</span>
                  <StatusBadge status={a.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Balance</p>
                    <p className="font-semibold tabular">{formatCents(a.balance_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Available</p>
                    <p className="font-semibold tabular">{formatCents(a.available_cents)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Daily limit</p>
                    <p className="font-semibold tabular">{formatCents(a.daily_transfer_limit_cents)}</p>
                  </div>
                </div>
                {a.status_reason && <p className="text-xs text-muted-foreground">Reason: {a.status_reason}</p>}
                <div className="flex flex-wrap gap-2">
                  {a.status === "active" ? (
                    <ActionButton
                      action={setAccountStatusAction.bind(null, a.id, "frozen", "Frozen by ACME Support for review")}
                      confirm={{ title: `Freeze ${a.nickname}?`, description: "Outgoing transfers and card purchases will be blocked. Incoming deposits still post.", confirmLabel: "Freeze account", destructive: true }}
                    >
                      <Snowflake /> Freeze
                    </ActionButton>
                  ) : a.status === "frozen" ? (
                    <ActionButton action={setAccountStatusAction.bind(null, a.id, "active", undefined)}>
                      <Sun /> Unfreeze
                    </ActionButton>
                  ) : null}
                  <a
                    href={`/api/statements?${new URLSearchParams({ account: a.id, from: addDays(today, -60), to: today, format: "pdf" })}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <FileText /> 60-day statement
                  </a>
                </div>
                <details className="rounded-lg border px-4 py-2">
                  <summary className="cursor-pointer text-sm font-medium">Simulate a deposit</summary>
                  <div className="pt-3">
                    <DepositForm accountId={a.id} />
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
          <div>
            <h2 className="mb-3 font-semibold">Recent activity</h2>
            {activity.rows.length ? <ActivityList rows={activity.rows} accountNames={names} /> : <p className="text-sm text-muted-foreground">No activity.</p>}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <DefinitionList
                items={[
                  ["Phone", p.phone ?? "—"],
                  ["Address", p.address_line1 ? `${p.address_line1}, ${p.city ?? ""} ${p.state ?? ""}` : "—"],
                  ["Date of birth", p.date_of_birth ?? "—"],
                  ["Joined", formatDate(p.created_at)],
                  ["Demo persona", p.persona ?? "—"],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cards</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {c.cards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      ••{card.last4} <StatusBadge status={card.status} className="ml-1" />
                      <span className="block text-xs text-muted-foreground">{formatCents(card.daily_limit_cents)}/day</span>
                    </span>
                    {card.status !== "cancelled" && (
                      <ActionButton size="xs" action={staffCardLockAction.bind(null, card.id, card.status !== "locked")}>
                        {card.status === "locked" ? <LockOpen /> : <Lock />} {card.status === "locked" ? "Unlock" : "Lock"}
                      </ActionButton>
                    )}
                  </li>
                ))}
                {c.cards.length === 0 && <li className="py-2 text-muted-foreground">No cards.</li>}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {c.tickets.map((t) => (
                  <li key={t.id} className="py-2">
                    <Link href={`/staff/tickets/${t.id}`} className="flex items-center justify-between gap-2 hover:underline">
                      <span className="truncate">#{t.number} {t.subject}</span>
                      <StatusBadge status={t.status} />
                    </Link>
                  </li>
                ))}
                {c.tickets.length === 0 && <li className="py-2 text-muted-foreground">No tickets.</li>}
              </ul>
            </CardContent>
          </Card>
          {c.applications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {c.applications.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2">
                      <span>
                        {a.account_type} · risk {a.risk_score}
                        <span className="block text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                      </span>
                      <StatusBadge status={a.status} />
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

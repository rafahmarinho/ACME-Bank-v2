import type { Metadata } from "next";
import { CalendarClock, Pause, Play, Repeat, X, Zap } from "lucide-react";
import { requireCustomer, getSimNow } from "@/services/session";
import { listAccounts } from "@/services/accounts";
import { listBeneficiaries } from "@/services/beneficiaries";
import { listScheduledPayments } from "@/services/payments";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { FilterBar } from "@/components/common/list-controls";
import { ScheduleDialog } from "@/components/banking/schedule-dialog";
import { runScheduleNowAction, setScheduleStatusAction } from "@/actions/banking";
import { formatCents, formatDateTime, formatPlainDate, localIsoDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Scheduled payments" };

const FREQ: Record<string, string> = { once: "One time", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const { supabase, userId } = await requireCustomer();
  const [accounts, beneficiaries, schedules, now] = await Promise.all([
    listAccounts(supabase, userId),
    listBeneficiaries(supabase, userId),
    listScheduledPayments(supabase, userId),
    getSimNow(),
  ]);
  const today = localIsoDate(now);
  const list = schedules.filter(
    (s) => (!q || s.description.toLowerCase().includes(q) || s.beneficiary?.name.toLowerCase().includes(q)) && (!status || s.status === status),
  );
  const monthly = schedules
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.frequency === "weekly" ? s.amount_cents * 4.33 : s.frequency === "biweekly" ? s.amount_cents * 2.17 : s.frequency === "monthly" ? s.amount_cents : 0), 0);

  return (
    <div>
      <PageHeader
        title="Scheduled payments"
        description={<>About <span className="font-medium text-foreground">{formatCents(Math.round(monthly))}</span> per month in recurring payments.</>}
        actions={
          <ScheduleDialog
            today={today}
            accounts={accounts.filter((a) => a.status === "active").map((a) => ({ id: a.id, label: `${a.nickname} ••${a.account_number.slice(-4)}` }))}
            beneficiaries={beneficiaries.map((b) => ({ id: b.id, label: `${b.name} — ${b.bank_name}` }))}
          />
        }
      />
      <FilterBar
        action="/payments"
        values={{ q: q || undefined, status: status || undefined }}
        searchPlaceholder="Search payments"
        filters={[{ type: "select", name: "status", label: "Status", options: ["active", "paused", "completed", "cancelled"].map((v) => ({ value: v, label: titleCase(v) })) }]}
      />
      <div className="mt-4">
        {list.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No scheduled payments" description="Automate rent, bills and savings so you never miss a date." />
        ) : (
          <ul className="space-y-3">
            {list.map((s) => {
              const to = s.beneficiary ? `${s.beneficiary.name} ••${s.beneficiary.account_number.slice(-4)}` : `${s.to_account?.nickname} ••${s.to_account?.account_number.slice(-4)}`;
              const failed = s.last_result && !["posted", "pending"].includes(s.last_result);
              return (
                <li key={s.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
                  <span className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground sm:flex">
                    <Repeat className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {s.description} <StatusBadge status={s.status} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {FREQ[s.frequency]} · to {to} · from {s.from_account?.nickname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "active" ? `Next: ${formatPlainDate(s.next_run_date)}` : "Not scheduled"}
                      {s.end_date ? ` · ends ${formatPlainDate(s.end_date)}` : ""}
                      {s.last_run_at ? ` · last run ${formatDateTime(s.last_run_at)}` : ""}
                      {s.last_result && (
                        <span className={failed ? "text-destructive" : ""}> ({failed ? s.last_result : titleCase(s.last_result)})</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="text-lg font-semibold tabular">{formatCents(s.amount_cents)}</span>
                    <div className="flex gap-1">
                      {s.status === "active" && (
                        <>
                          <ActionButton
                            size="xs"
                            action={runScheduleNowAction.bind(null, s.id)}
                            confirm={{ title: "Pay now?", description: `${formatCents(s.amount_cents)} will be sent to ${to} immediately. Fee: free. The next date moves forward.`, confirmLabel: "Pay now" }}
                          >
                            <Zap /> Pay now
                          </ActionButton>
                          <ActionButton size="xs" action={setScheduleStatusAction.bind(null, s.id, "paused")}>
                            <Pause /> Pause
                          </ActionButton>
                        </>
                      )}
                      {s.status === "paused" && (
                        <ActionButton size="xs" action={setScheduleStatusAction.bind(null, s.id, "active")}>
                          <Play /> Resume
                        </ActionButton>
                      )}
                      {(s.status === "active" || s.status === "paused") && (
                        <ActionButton
                          size="xs"
                          variant="ghost"
                          action={setScheduleStatusAction.bind(null, s.id, "cancelled")}
                          confirm={{ title: "Cancel this scheduled payment?", description: "Future payments will stop. This can't be undone.", confirmLabel: "Cancel payment", destructive: true }}
                        >
                          <X /> Cancel
                        </ActionButton>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

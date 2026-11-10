import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { requireCustomer } from "@/services/session";
import { listAccounts } from "@/services/accounts";
import { listBeneficiaries } from "@/services/beneficiaries";
import { listFees, listTransfers } from "@/services/transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { TransferWizard } from "@/components/banking/transfer-wizard";
import { cancelTransferAction } from "@/actions/banking";
import { formatCents, formatDateTime, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Transfers" };

export default async function TransfersPage({ searchParams }: PageProps<"/transfers">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireCustomer();
  const [accounts, beneficiaries, fees] = await Promise.all([
    listAccounts(supabase, userId),
    listBeneficiaries(supabase, userId),
    listFees(supabase),
  ]);
  const transfers = await listTransfers(supabase, accounts.map((a) => a.id), undefined, 30);
  const pending = transfers.filter((t) => t.status === "pending");
  const history = transfers.filter((t) => t.status !== "pending");
  const rail = (t: (typeof transfers)[number]) =>
    t.kind === "bill_payment" ? "Bill pay" : t.rail === "internal" ? "ACME" : t.rail?.toUpperCase();

  return (
    <div>
      <PageHeader title="Transfers" description="Send money instantly to ACME customers or to any US bank account." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <TransferWizard
            accounts={accounts.map((a) => ({ id: a.id, nickname: a.nickname, last4: a.account_number.slice(-4), available: a.available_cents ?? 0, status: a.status }))}
            beneficiaries={beneficiaries.map((b) => ({ id: b.id, name: b.name, bank: b.bank_name, last4: b.account_number.slice(-4), internal: Boolean(b.internal_account_id) }))}
            defaultFrom={typeof sp.from === "string" ? sp.from : undefined}
            defaultDestination={typeof sp.to === "string" ? sp.to : undefined}
          />
          <Card>
            <CardHeader>
              <CardTitle>Transfer fees</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {fees
                  .filter((f) => f.code.startsWith("transfer_") || f.code === "bill_payment")
                  .map((f) => (
                    <li key={f.code} className="flex justify-between gap-4 py-2.5">
                      <span>
                        <span className="block font-medium">{f.name}</span>
                        <span className="block text-xs text-muted-foreground">{f.description}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular">
                        {f.percent_bps ? `${f.percent_bps / 100}%` : f.flat_cents ? formatCents(f.flat_cents) : "Free"}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending ({pending.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transfers waiting to settle.</p>
              ) : (
                <ul className="divide-y">
                  {pending.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {rail(t)} · {t.requires_review ? "Under review" : `settles ${formatShortDate(t.settles_at)}`} · {t.reference}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-sm font-semibold tabular">{formatCents(-(t.amount_cents + t.fee_cents))}</span>
                        <ActionButton
                          size="xs"
                          action={cancelTransferAction.bind(null, t.id)}
                          confirm={{
                            title: "Cancel this transfer?",
                            description: `${formatCents(t.amount_cents + t.fee_cents)} will be released back to your available balance.`,
                            confirmLabel: "Cancel transfer",
                            destructive: true,
                          }}
                        >
                          Cancel
                        </ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent transfers</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} title="No transfers yet" />
              ) : (
                <ul className="divide-y">
                  {history.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDateTime(t.created_at)} · {rail(t)}
                          {t.failure_reason ? ` · ${t.failure_reason}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold tabular">{formatCents(-(t.amount_cents + t.fee_cents))}</span>
                        {t.status !== "posted" && <StatusBadge status={t.status} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

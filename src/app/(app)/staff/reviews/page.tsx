import type { Metadata } from "next";
import { Check, ClipboardCheck, X } from "lucide-react";
import { requireStaff } from "@/services/session";
import { listReviews } from "@/services/staff";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionList, EmptyState, PageHeader } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { decideApplicationAction, reviewTransferAction } from "@/actions/staff";
import { formatCents, formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewsPage() {
  const { supabase } = await requireStaff();
  const { transfers, applications } = await listReviews(supabase);

  return (
    <div>
      <PageHeader title="Review queue" description="Large transfers and identity checks that need a human decision." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="font-semibold">Transfers held for review ({transfers.length})</h2>
          {transfers.length === 0 && <EmptyState icon={ClipboardCheck} title="No transfers to review" />}
          {transfers.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle>{formatCents(t.amount_cents)} to {t.counterparty_name}</CardTitle>
                <CardDescription>
                  {t.account?.owner?.full_name} · {t.reference} · {formatDateTime(t.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DefinitionList
                  items={[
                    ["From", `${t.account?.nickname} ••${t.account?.account_number.slice(-4)}`],
                    ["Method", t.rail?.toUpperCase() ?? "—"],
                    ["Fee", formatCents(t.fee_cents)],
                    ["Funds on hold", formatCents(t.hold_cents)],
                    ["Memo", (t.metadata as { memo?: string })?.memo || "—"],
                  ]}
                />
                <div className="flex gap-2">
                  <ActionButton
                    variant="default"
                    action={reviewTransferAction.bind(null, t.id, true, "Verified with customer")}
                    confirm={{ title: "Approve this transfer?", description: `${formatCents(t.amount_cents)} will be released to the payment network.`, confirmLabel: "Approve" }}
                  >
                    <Check /> Approve
                  </ActionButton>
                  <ActionButton
                    action={reviewTransferAction.bind(null, t.id, false, "Could not verify the payment with the customer")}
                    confirm={{ title: "Reject this transfer?", description: "The hold is released and the customer is notified.", confirmLabel: "Reject", destructive: true }}
                  >
                    <X /> Reject
                  </ActionButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Account applications ({applications.length})</h2>
          {applications.length === 0 && (
            <EmptyState icon={ClipboardCheck} title="No applications waiting" description="Apply the Manual KYC scenario or use SSN 0000 to send applications here." />
          )}
          {applications.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.full_name}</CardTitle>
                <CardDescription>
                  {a.user?.email} · submitted {formatDateTime(a.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <DefinitionList
                  items={[
                    ["Product", titleCase(a.account_type)],
                    ["Date of birth", a.date_of_birth],
                    ["Address", `${a.address_line1}, ${a.city}, ${a.state} ${a.postal_code}`],
                    ["SSN (last 4)", `•••-••-${a.ssn_last4}`],
                    ["Employment", titleCase(a.employment_status)],
                    ["Annual income", formatCents(a.annual_income_cents)],
                    ["Opening deposit", formatCents(a.initial_deposit_cents)],
                    ["Risk score", <span key="r" className={a.risk_score >= 50 ? "text-destructive" : ""}>{a.risk_score} / 100</span>],
                  ]}
                />
                <div className="flex gap-2">
                  <ActionButton variant="default" action={decideApplicationAction.bind(null, a.id, true, "Documents verified by staff")}>
                    <Check /> Approve & open account
                  </ActionButton>
                  <ActionButton
                    action={decideApplicationAction.bind(null, a.id, false, "We could not verify your identity with the information provided.")}
                    confirm={{ title: "Reject this application?", description: "The applicant will be notified and can apply again.", confirmLabel: "Reject", destructive: true }}
                  >
                    <X /> Reject
                  </ActionButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

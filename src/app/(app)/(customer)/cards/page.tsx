import type { Metadata } from "next";
import { CreditCard, Lock, LockOpen, RefreshCcw } from "lucide-react";
import { requireCustomer, getSimNow } from "@/services/session";
import { cardSpending, listCards, recentCardTransactions } from "@/services/cards";
import { listFees } from "@/services/transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { CategoryIcon } from "@/components/banking/activity-list";
import { CardSettingsDialog, CardVisual, SimulatePurchaseDialog } from "@/components/banking/card-controls";
import { replaceCardAction, toggleCardLockAction } from "@/actions/banking";
import { formatCents, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const { supabase, userId } = await requireCustomer();
  const [cards, now, fees] = await Promise.all([listCards(supabase, userId), getSimNow(), listFees(supabase)]);
  const ids = cards.map((c) => c.id);
  const [spend, recent] = await Promise.all([cardSpending(supabase, ids, now), recentCardTransactions(supabase, ids)]);
  const replacementFee = fees.find((f) => f.code === "card_replacement")?.flat_cents ?? 0;
  const usable = cards.filter((c) => c.status !== "cancelled");

  return (
    <div>
      <PageHeader
        title="Cards"
        description="Lock cards instantly, set spending limits and control where your card works."
        actions={<SimulatePurchaseDialog cards={usable.map((c) => ({ id: c.id, label: `${c.brand} ••${c.last4} · ${c.account?.nickname}` }))} />}
      />
      {cards.length === 0 ? (
        <EmptyState icon={CreditCard} title="No cards yet" description="Debit cards are issued automatically with every checking account." />
      ) : (
        <div className="space-y-6">
          {usable.map((c) => {
            const s = spend.get(c.id) ?? { today: 0, month: 0 };
            const locked = c.status === "locked";
            return (
              <Card key={c.id}>
                <CardContent className="grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
                  <div className="space-y-3">
                    <CardVisual card={c} />
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        variant={locked ? "default" : "outline"}
                        action={toggleCardLockAction.bind(null, c.id, !locked)}
                        confirm={
                          locked
                            ? undefined
                            : { title: `Lock card ••${c.last4}?`, description: "New purchases, ATM withdrawals and online payments will be declined until you unlock it. Scheduled payments are not affected.", confirmLabel: "Lock card" }
                        }
                      >
                        {locked ? <LockOpen /> : <Lock />} {locked ? "Unlock card" : "Lock card"}
                      </ActionButton>
                      <CardSettingsDialog card={c} />
                      <ActionButton
                        variant="ghost"
                        action={replaceCardAction.bind(null, c.id)}
                        confirm={{
                          title: "Replace this card?",
                          description: (
                            <>
                              Card ••{c.last4} will be cancelled immediately and a new card with a new number will be issued.
                              <span className="mt-2 block font-medium text-foreground">Replacement fee: {formatCents(replacementFee)}</span>
                            </>
                          ),
                          confirmLabel: `Replace for ${formatCents(replacementFee)}`,
                          destructive: true,
                        }}
                      >
                        <RefreshCcw /> Report lost / replace
                      </ActionButton>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">
                        {c.brand} debit ••{c.last4}
                      </h2>
                      <StatusBadge status={c.status} />
                      <span className="text-sm text-muted-foreground">Linked to {c.account?.nickname} ••{c.account?.account_number.slice(-4)}</span>
                    </div>
                    {c.status_reason && locked && <p className="rounded-lg bg-warning/12 px-3 py-2 text-sm">{c.status_reason}</p>}
                    {[
                      ["Spent today", s.today, c.daily_limit_cents],
                      ["Spent this month", s.month, c.monthly_limit_cents],
                    ].map(([label, used, limit]) => {
                      const pct = Math.min(100, Math.round(((used as number) / Math.max(1, limit as number)) * 100));
                      return (
                        <div key={label as string} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="tabular">
                              <span className="font-medium">{formatCents(used as number)}</span> of {formatCents(limit as number)}
                            </span>
                          </div>
                          <Progress value={pct} className={cn(pct > 85 && "[&_[data-slot=progress-indicator]]:bg-destructive")} />
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        ["Online", c.online_enabled],
                        ["Contactless", c.contactless_enabled],
                        ["International", c.international_enabled],
                      ].map(([k, v]) => (
                        <div key={k as string} className={cn("rounded-lg border px-2 py-2", v ? "border-success/30 bg-success/8 text-success" : "text-muted-foreground")}>
                          <p className="font-medium">{k}</p>
                          <p>{v ? "On" : "Off"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardHeader>
              <CardTitle>Recent card activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No card purchases yet.</p>
              ) : (
                <ul className="divide-y">
                  {recent.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <CategoryIcon category={t.category} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDateTime(t.created_at)} · ••{(t.metadata as { card_last4?: string })?.card_last4}
                          {t.failure_reason ? ` · ${t.failure_reason}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn("text-sm font-semibold tabular", t.status === "failed" && "text-muted-foreground line-through")}>
                          {formatCents(-(t.amount_cents + t.fee_cents))}
                        </span>
                        {t.status !== "posted" && <StatusBadge status={t.status} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {cards.some((c) => c.status === "cancelled") && (
            <p className="text-sm text-muted-foreground">
              Cancelled cards: {cards.filter((c) => c.status === "cancelled").map((c) => `••${c.last4}`).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

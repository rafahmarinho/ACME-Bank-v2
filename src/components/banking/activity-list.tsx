import {
  ArrowDownLeft,
  ArrowLeftRight,
  Banknote,
  Car,
  Clapperboard,
  HeartPulse,
  type LucideIcon,
  Percent,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents, formatDayHeading, formatTime, localIsoDate, titleCase } from "@/lib/format";
import { StatusBadge } from "@/components/common/display";
import type { Activity } from "@/lib/types";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Groceries: ShoppingCart,
  Dining: Utensils,
  Shopping: ShoppingBag,
  Transport: Car,
  Entertainment: Clapperboard,
  Health: HeartPulse,
  Travel: Plane,
  "Bills & Utilities": Receipt,
  Transfers: ArrowLeftRight,
  Income: Banknote,
  Interest: Percent,
  Fees: Receipt,
};

export function CategoryIcon({ category, credit, className }: { category: string | null; credit?: boolean; className?: string }) {
  const Icon = (category && CATEGORY_ICONS[category]) || (credit ? ArrowDownLeft : Wallet);
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        credit ? "bg-success/12 text-success" : "bg-secondary text-primary dark:text-white",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

const RAIL_LABEL: Record<string, string> = { ach: "ACH", instant: "Instant", wire: "Wire", internal: "ACME transfer" };

export function ActivityRow({ row, showAccount }: { row: Activity; showAccount?: string }) {
  const credit = row.direction === "credit";
  const muted = row.status === "failed" || row.status === "cancelled";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <CategoryIcon category={row.category} credit={credit} className={cn(muted && "opacity-50")} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", muted && "text-muted-foreground line-through decoration-1")}>{row.description}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatTime(row.created_at!)} · {row.category}
          {row.rail && row.kind !== "card_purchase" ? ` · ${RAIL_LABEL[row.rail] ?? row.rail}` : ""}
          {showAccount ? ` · ${showAccount}` : ""}
          {row.failure_reason ? ` · ${row.failure_reason}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={cn("text-sm font-semibold tabular", credit && !muted && "text-success", muted && "text-muted-foreground")}>
          {formatCents(row.signed_amount_cents, { sign: true })}
        </span>
        {row.status !== "posted" ? (
          <StatusBadge status={row.requires_review && row.status === "pending" ? "pending_review" : row.status!} />
        ) : row.fee_cents ? (
          <span className="text-[11px] text-muted-foreground">incl. {formatCents(row.fee_cents)} fee</span>
        ) : null}
      </div>
    </li>
  );
}

/** Transactions grouped by local day, newest first. */
export function ActivityList({ rows, accountNames }: { rows: Activity[]; accountNames?: Record<string, string> }) {
  const groups = new Map<string, Activity[]>();
  for (const r of rows) {
    const d = localIsoDate(r.created_at!);
    groups.set(d, [...(groups.get(d) ?? []), r]);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="overflow-hidden rounded-xl border bg-card">
          <h3 className="border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
            {formatDayHeading(items[0].created_at!)}
          </h3>
          <ul className="divide-y">
            {items.map((r) => (
              <ActivityRow key={`${r.id}-${r.account_id}`} row={r} showAccount={accountNames?.[r.account_id!]} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export const STATUS_OPTIONS = ["posted", "pending", "failed", "cancelled"].map((v) => ({
  value: v,
  label: v === "failed" ? "Declined / failed" : titleCase(v),
}));

export const KIND_OPTIONS = [
  "card_purchase",
  "transfer",
  "bill_payment",
  "deposit",
  "payroll",
  "interest",
  "fee",
  "opening_deposit",
].map((v) => ({ value: v, label: titleCase(v) }));

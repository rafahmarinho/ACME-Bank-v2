import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCents, titleCase } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold tracking-wider text-brand uppercase">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-[28px] dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Money({
  cents,
  sign = false,
  className,
  colored = false,
}: {
  cents: number | null | undefined;
  sign?: boolean;
  className?: string;
  colored?: boolean;
}) {
  const v = Number(cents ?? 0);
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        colored && v > 0 && "text-success",
        colored && v < 0 && "text-foreground",
        className,
      )}
    >
      {formatCents(v, { sign })}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  posted: "bg-success/12 text-success",
  active: "bg-success/12 text-success",
  approved: "bg-success/12 text-success",
  verified: "bg-success/12 text-success",
  resolved: "bg-success/12 text-success",
  completed: "bg-secondary text-secondary-foreground",
  pending: "bg-warning/18 text-amber-700 dark:text-warning",
  pending_review: "bg-warning/18 text-amber-700 dark:text-warning",
  pending_customer: "bg-chart-3/15 text-chart-3",
  open: "bg-brand/15 text-accent-foreground",
  paused: "bg-muted text-muted-foreground",
  locked: "bg-warning/18 text-amber-700 dark:text-warning",
  frozen: "bg-chart-3/15 text-chart-3",
  failed: "bg-destructive/12 text-destructive",
  rejected: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  not_started: "bg-muted text-muted-foreground",
  urgent: "bg-destructive/12 text-destructive",
  high: "bg-brand/15 text-accent-foreground",
  normal: "bg-secondary text-secondary-foreground",
  low: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  failed: "Declined",
  pending_customer: "Awaiting customer",
  pending_review: "In review",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STATUS_STYLES[status] ?? "bg-muted", className)}>
      {STATUS_LABELS[status] ?? titleCase(status)}
    </Badge>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center", className)}>
      <div className="mb-3 rounded-full bg-accent p-3 text-accent-foreground">
        <Icon className="size-5" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", accent && "border-brand/40 bg-accent/40")}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("size-4", accent ? "text-brand" : "text-muted-foreground")} />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-primary tabular dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DefinitionList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

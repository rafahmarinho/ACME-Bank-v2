import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

type Event = {
  id: number;
  type: string;
  severity: string;
  message: string;
  occurred_at: string;
  subject?: { full_name: string } | null;
  actor?: { full_name: string } | null;
};

const ICON = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle } as const;
const COLOR = { info: "text-chart-3", success: "text-success", warning: "text-amber-600 dark:text-warning", error: "text-destructive" } as const;

export function EventList({ events, compact = false }: { events: Event[]; compact?: boolean }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ul className="divide-y">
      {events.map((e) => {
        const sev = (e.severity in ICON ? e.severity : "info") as keyof typeof ICON;
        const Icon = ICON[sev];
        return (
          <li key={e.id} className={cn("flex gap-3", compact ? "py-2" : "py-3")}>
            <Icon className={cn("mt-0.5 size-4 shrink-0", COLOR[sev])} />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", compact && "truncate")}>{e.message}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{e.type}</span> · {formatDateTime(e.occurred_at)}
                {e.subject?.full_name ? ` · ${e.subject.full_name}` : ""}
                {e.actor?.full_name ? ` · by ${e.actor.full_name}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

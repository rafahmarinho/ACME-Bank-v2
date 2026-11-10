import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { requireStaff } from "@/services/session";
import { listTickets, TICKET_CATEGORIES } from "@/services/support";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { FilterBar } from "@/components/common/list-controls";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Support tickets" };

export default async function StaffTicketsPage({ searchParams }: PageProps<"/staff/tickets">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const { supabase, userId } = await requireStaff();
  const status = s("status") ?? (sp.status === undefined ? "active" : undefined);
  const tickets = await listTickets(supabase, {
    q: s("q"),
    status,
    priority: s("priority"),
    assignedTo: s("mine") === "1" ? userId : undefined,
  });

  return (
    <div>
      <PageHeader title="Support tickets" description="Customer conversations across all channels." />
      <FilterBar
        action="/staff/tickets"
        values={{ q: s("q"), status, priority: s("priority"), mine: s("mine") }}
        searchPlaceholder="Search subject or ticket #"
        filters={[
          {
            type: "select",
            name: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active (open + awaiting)" },
              { value: "open", label: "Open" },
              { value: "pending_customer", label: "Awaiting customer" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ],
          },
          { type: "select", name: "priority", label: "Priority", options: ["urgent", "high", "normal", "low"].map((v) => ({ value: v, label: titleCase(v) })) },
          { type: "select", name: "mine", label: "Assignee", options: [{ value: "1", label: "Assigned to me" }] },
        ]}
      />
      <div className="mt-4">
        {tickets.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No tickets match" />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/staff/tickets/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      #{t.number} · {t.subject}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.customer?.full_name} · {TICKET_CATEGORIES.find((c) => c.value === t.category)?.label} · {t.assignee?.full_name ?? "Unassigned"} · {formatDateTime(t.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

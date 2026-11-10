import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Headset, Phone, ShieldAlert } from "lucide-react";
import { requireCustomer } from "@/services/session";
import { listTickets, TICKET_CATEGORIES } from "@/services/support";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { FilterBar } from "@/components/common/list-controls";
import { NewTicketDialog } from "@/components/support/ticket-forms";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: PageProps<"/support">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" && sp.status ? sp.status : undefined;
  const { supabase, userId } = await requireCustomer();
  const tickets = await listTickets(supabase, { customerId: userId, q, status });

  return (
    <div>
      <PageHeader title="Support" description="Questions, disputes or problems — we're here to help." actions={<NewTicketDialog />} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <ShieldAlert className="size-5 text-destructive" />
          <div className="text-sm">
            <p className="font-medium">Lost or stolen card?</p>
            <Link href="/cards" className="text-primary underline-offset-2 hover:underline dark:text-brand">Lock it now</Link>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <Phone className="size-5 text-brand" />
          <div className="text-sm">
            <p className="font-medium">Call us 24/7</p>
            <p className="text-muted-foreground">(555) 010-2263</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <Headset className="size-5 text-brand" />
          <div className="text-sm">
            <p className="font-medium">Average reply time</p>
            <p className="text-muted-foreground">Under 4 business hours</p>
          </div>
        </div>
      </div>

      <FilterBar
        action="/support"
        values={{ q, status }}
        searchPlaceholder="Search by subject or ticket number"
        filters={[
          {
            type: "select",
            name: "status",
            label: "Status",
            options: [
              { value: "active", label: "Open & awaiting reply" },
              { value: "open", label: "Open" },
              { value: "pending_customer", label: "Awaiting your reply" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
            ],
          },
        ]}
      />
      <div className="mt-4">
        {tickets.length === 0 ? (
          <EmptyState icon={Headset} title="No support requests" description="When you contact us, your conversations appear here." />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      #{t.number} · {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TICKET_CATEGORIES.find((c) => c.value === t.category)?.label} · updated {formatDateTime(t.updated_at)}
                    </p>
                  </div>
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

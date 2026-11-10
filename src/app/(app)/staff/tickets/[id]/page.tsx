import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/services/session";
import { getTicket, TICKET_CATEGORIES } from "@/services/support";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DefinitionList, PageHeader, StatusBadge } from "@/components/common/display";
import { ReplyForm } from "@/components/support/ticket-forms";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketControls } from "@/components/staff/ticket-controls";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Ticket" };

export default async function StaffTicketPage({ params }: PageProps<"/staff/tickets/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireStaff();
  const [data, { data: staff }] = await Promise.all([
    getTicket(supabase, id),
    supabase.from("profiles").select("id, full_name").in("role", ["support", "admin"]).order("full_name"),
  ]);
  if (!data) notFound();
  const { ticket, messages } = data;

  return (
    <div>
      <Link href="/staff/tickets" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tickets
      </Link>
      <PageHeader
        eyebrow={`Ticket #${ticket.number} · ${TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label}`}
        title={ticket.subject}
        description={<><StatusBadge status={ticket.status} /> <StatusBadge status={ticket.priority} /></>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <TicketThread messages={messages} viewerId={userId} />
          <ReplyForm ticketId={ticket.id} staff />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <DefinitionList
                items={[
                  ["Name", <Link key="n" href={`/staff/customers/${ticket.customer?.id}`} className="text-primary hover:underline dark:text-brand">{ticket.customer?.full_name}</Link>],
                  ["Email", ticket.customer?.email ?? "—"],
                  ["Customer #", ticket.customer?.customer_number ?? "—"],
                  ["Opened", formatDateTime(ticket.created_at)],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Manage</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketControls
                ticketId={ticket.id}
                status={ticket.status}
                priority={ticket.priority}
                assignedTo={ticket.assigned_to}
                staff={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

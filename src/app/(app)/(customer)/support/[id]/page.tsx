import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireCustomer } from "@/services/session";
import { getTicket, TICKET_CATEGORIES } from "@/services/support";
import { PageHeader, StatusBadge } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { ReplyForm } from "@/components/support/ticket-forms";
import { TicketThread } from "@/components/support/ticket-thread";
import { updateTicketAction } from "@/actions/account";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Support request" };

export default async function TicketPage({ params }: PageProps<"/support/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireCustomer();
  const data = await getTicket(supabase, id);
  if (!data || data.ticket.customer_id !== userId) notFound();
  const { ticket, messages } = data;
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/support" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All requests
      </Link>
      <PageHeader
        eyebrow={`Ticket #${ticket.number} · ${TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label}`}
        title={ticket.subject}
        description={<>Opened {formatDateTime(ticket.created_at)} · <StatusBadge status={ticket.status} /></>}
        actions={
          !closed && (
            <ActionButton action={updateTicketAction.bind(null, ticket.id, { status: "closed" })} confirm={{ title: "Close this request?", description: "Let us know it's solved. You can reopen it by replying.", confirmLabel: "Close request" }}>
              <CheckCircle2 /> Mark as solved
            </ActionButton>
          )
        }
      />
      <div className="space-y-6">
        <TicketThread messages={messages} viewerId={userId} />
        <ReplyForm ticketId={ticket.id} closed={closed} />
      </div>
    </div>
  );
}

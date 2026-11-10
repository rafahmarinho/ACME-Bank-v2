import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export const TICKET_CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "card", label: "Cards" },
  { value: "transfer", label: "Transfers & payments" },
  { value: "account", label: "Account & limits" },
  { value: "fraud", label: "Fraud or dispute" },
  { value: "statement", label: "Statements" },
  { value: "technical", label: "App or sign-in problem" },
] as const;

export type TicketFilters = { customerId?: string; status?: string; priority?: string; q?: string; assignedTo?: string };

export async function listTickets(db: DbClient, f: TicketFilters = {}) {
  let query = db
    .from("support_tickets")
    .select("*, customer:profiles!support_tickets_customer_id_fkey(full_name, email), assignee:profiles!support_tickets_assigned_to_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (f.customerId) query = query.eq("customer_id", f.customerId);
  if (f.status === "active") query = query.in("status", ["open", "pending_customer"]);
  else if (f.status) query = query.eq("status", f.status as TicketStatus);
  if (f.priority) query = query.eq("priority", f.priority as TicketPriority);
  if (f.assignedTo) query = query.eq("assigned_to", f.assignedTo);
  if (f.q) {
    const q = f.q.replace(/[%,()]/g, " ").trim();
    if (/^\d+$/.test(q)) query = query.eq("number", Number(q));
    else if (q) query = query.ilike("subject", `%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTicket(db: DbClient, id: string) {
  const { data: ticket, error } = await db
    .from("support_tickets")
    .select("*, customer:profiles!support_tickets_customer_id_fkey(id, full_name, email, customer_number), assignee:profiles!support_tickets_assigned_to_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) return null;
  const { data: messages } = await db
    .from("ticket_messages")
    .select("*, author:profiles(full_name, role, avatar_path)")
    .eq("ticket_id", id)
    .order("created_at");

  const withUrls = await Promise.all(
    (messages ?? []).map(async (m) => {
      if (!m.attachment_path) return { ...m, attachment_url: null as string | null };
      const { data } = await db.storage.from("support-attachments").createSignedUrl(m.attachment_path, 600);
      return { ...m, attachment_url: data?.signedUrl ?? null };
    }),
  );
  return { ticket, messages: withUrls };
}

async function uploadAttachment(db: DbClient, ticketId: string, file: File | null) {
  if (!file || file.size === 0) return { path: null, name: null };
  if (file.size > 5 * 1024 * 1024) throw new Error("Attachments must be 5 MB or smaller");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${ticketId}/${Date.now()}-${safe}`;
  const { error } = await db.storage.from("support-attachments").upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { path, name: file.name };
}

export async function createTicket(
  db: DbClient,
  userId: string,
  input: { subject: string; category: string; body: string; priority?: TicketPriority; file?: File | null },
) {
  const { data: ticket, error } = await db
    .from("support_tickets")
    .insert({
      customer_id: userId,
      subject: input.subject,
      category: input.category,
      priority: input.priority ?? (input.category === "fraud" ? "high" : "normal"),
    })
    .select()
    .single();
  if (error) throw error;
  const attachment = await uploadAttachment(db, ticket.id, input.file ?? null);
  const { error: msgError } = await db.from("ticket_messages").insert({
    ticket_id: ticket.id,
    author_id: userId,
    body: input.body,
    attachment_path: attachment.path,
    attachment_name: attachment.name,
  });
  if (msgError) throw msgError;
  return ticket;
}

export async function addMessage(
  db: DbClient,
  userId: string,
  ticketId: string,
  input: { body: string; internal?: boolean; file?: File | null },
) {
  const attachment = await uploadAttachment(db, ticketId, input.file ?? null);
  const { error } = await db.from("ticket_messages").insert({
    ticket_id: ticketId,
    author_id: userId,
    body: input.body,
    is_internal: input.internal ?? false,
    attachment_path: attachment.path,
    attachment_name: attachment.name,
  });
  if (error) throw error;
}

export async function updateTicket(
  db: DbClient,
  ticketId: string,
  patch: { status?: TicketStatus; priority?: TicketPriority; assigned_to?: string | null },
) {
  const { error } = await db.from("support_tickets").update(patch).eq("id", ticketId);
  if (error) throw error;
}

import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import { localIsoDate, localMidnightUtc } from "@/lib/format";

export async function getStaffOverview(db: DbClient, nowIso: string) {
  const todayStart = localMidnightUtc(localIsoDate(nowIso)).toISOString();
  const [customers, accounts, pendingTx, reviews, applications, tickets, failedToday, volumeToday, recentEvents] =
    await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").eq("kyc_status", "verified"),
      db.from("accounts").select("balance_cents, status").eq("is_system", false),
      db.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending").eq("requires_review", true),
      db.from("account_applications").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      db.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "pending_customer"]),
      db.from("transactions").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", todayStart),
      db.from("transactions").select("amount_cents").eq("status", "posted").gte("created_at", todayStart).limit(5000),
      db.from("sim_events").select("*").order("occurred_at", { ascending: false }).limit(8),
    ]);
  const deposits = (accounts.data ?? []).reduce((s, a) => s + a.balance_cents, 0);
  const frozen = (accounts.data ?? []).filter((a) => a.status === "frozen").length;
  return {
    customers: customers.count ?? 0,
    accounts: accounts.data?.length ?? 0,
    deposits,
    frozen,
    pending: pendingTx.count ?? 0,
    reviews: reviews.count ?? 0,
    applications: applications.count ?? 0,
    openTickets: tickets.count ?? 0,
    failedToday: failedToday.count ?? 0,
    volumeToday: (volumeToday.data ?? []).reduce((s, t) => s + t.amount_cents, 0),
    events: recentEvents.data ?? [],
  };
}

export async function listCustomers(db: DbClient, q?: string, kyc?: string) {
  let query = db
    .from("profiles")
    .select("*, accounts(id, balance_cents, status, is_system)")
    .eq("role", "customer")
    .order("full_name")
    .limit(200);
  if (kyc) query = query.eq("kyc_status", kyc);
  if (q) {
    const s = q.replace(/[%,()]/g, " ").trim();
    if (s) query = query.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,customer_number.ilike.%${s}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getCustomer(db: DbClient, id: string) {
  const [{ data: profile }, { data: accounts }, { data: cards }, { data: tickets }, { data: applications }] =
    await Promise.all([
      db.from("profiles").select("*").eq("id", id).maybeSingle(),
      db.from("accounts").select("*").eq("owner_id", id).order("opened_at"),
      db.from("cards").select("*").eq("owner_id", id).order("issued_at", { ascending: false }),
      db.from("support_tickets").select("*").eq("customer_id", id).order("updated_at", { ascending: false }).limit(10),
      db.from("account_applications").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    ]);
  return { profile, accounts: accounts ?? [], cards: cards ?? [], tickets: tickets ?? [], applications: applications ?? [] };
}

export async function listReviews(db: DbClient) {
  const [{ data: transfers }, { data: applications }] = await Promise.all([
    db
      .from("transactions")
      .select("*, account:accounts!transactions_account_id_fkey(nickname, account_number, available_cents, owner:profiles(full_name, email))")
      .eq("status", "pending")
      .eq("requires_review", true)
      .order("created_at"),
    db
      .from("account_applications")
      .select("*, user:profiles!account_applications_user_id_fkey(email)")
      .eq("status", "pending_review")
      .order("created_at"),
  ]);
  return { transfers: transfers ?? [], applications: applications ?? [] };
}

export async function listPendingSettlements(db: DbClient) {
  const { data } = await db
    .from("transactions")
    .select("*, account:accounts!transactions_account_id_fkey(nickname, owner:profiles(full_name))")
    .eq("status", "pending")
    .eq("requires_review", false)
    .order("settles_at")
    .limit(50);
  return data ?? [];
}

export type EventFilters = { type?: string; severity?: string; q?: string; page?: number };

export async function listEvents(db: DbClient, f: EventFilters = {}) {
  const pageSize = 40;
  const page = Math.max(1, f.page ?? 1);
  let query = db
    .from("sim_events")
    .select("*, subject:profiles!sim_events_subject_user_id_fkey(full_name), actor:profiles!sim_events_actor_id_fkey(full_name)", {
      count: "exact",
    })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (f.type) query = query.like("type", `${f.type}%`);
  if (f.severity) query = query.eq("severity", f.severity);
  if (f.q) {
    const s = f.q.replace(/[%,()]/g, " ").trim();
    if (s) query = query.ilike("message", `%${s}%`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function listStaffUsers(db: DbClient) {
  const { data, error } = await db.from("profiles").select("*").order("role").order("full_name");
  if (error) throw error;
  return data;
}

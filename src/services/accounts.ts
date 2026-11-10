import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import { addDays, localIsoDate, localMidnightUtc } from "@/lib/format";
import type { Account, Activity } from "@/lib/types";

export async function listAccounts(db: DbClient, ownerId: string): Promise<Account[]> {
  const { data, error } = await db
    .from("accounts")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("is_system", false)
    .order("opened_at");
  if (error) throw error;
  return data;
}

export async function getAccount(db: DbClient, id: string) {
  const { data, error } = await db.from("accounts").select("*").eq("id", id).eq("is_system", false).maybeSingle();
  if (error) throw error;
  return data;
}

export type ActivityFilters = {
  accountIds: string[];
  q?: string;
  status?: string;
  category?: string;
  direction?: "debit" | "credit";
  kind?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  page?: number;
  pageSize?: number;
};

export async function getActivity(db: DbClient, f: ActivityFilters) {
  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  if (f.accountIds.length === 0) return { rows: [] as Activity[], total: 0, page, pageSize };

  let query = db
    .from("account_activity")
    .select("*", { count: "exact" })
    .in("account_id", f.accountIds)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (f.q) {
    const q = f.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`description.ilike.%${q}%,counterparty_name.ilike.%${q}%,reference.ilike.%${q}%`);
  }
  if (f.status) query = query.eq("status", f.status as Activity["status"] & string);
  if (f.category) query = query.eq("category", f.category);
  if (f.kind) query = query.eq("kind", f.kind as Activity["kind"] & string);
  if (f.direction) query = query.eq("direction", f.direction);
  if (f.from) query = query.gte("created_at", localMidnightUtc(f.from).toISOString());
  if (f.to) query = query.lt("created_at", localMidnightUtc(addDays(f.to, 1)).toISOString());

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getLedger(db: DbClient, accountId: string, from: string, to: string) {
  const fromTs = localMidnightUtc(from).toISOString();
  const toTs = localMidnightUtc(addDays(to, 1)).toISOString();

  const [{ data: before }, { data: rows, error }] = await Promise.all([
    db
      .from("ledger_entries")
      .select("balance_after_cents")
      .eq("account_id", accountId)
      .lt("created_at", fromTs)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("ledger_entries")
      .select("*, transactions(reference, kind, category, counterparty_name, rail)")
      .eq("account_id", accountId)
      .gte("created_at", fromTs)
      .lt("created_at", toTs)
      .order("created_at")
      .order("id")
      .limit(2000),
  ]);
  if (error) throw error;

  const entries = rows ?? [];
  const opening = before?.balance_after_cents ?? 0;
  const credits = entries.filter((e) => e.direction === "credit").reduce((s, e) => s + e.amount_cents, 0);
  const debits = entries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amount_cents, 0);
  const closing = entries.length ? entries[entries.length - 1].balance_after_cents : opening;
  return { entries, opening, credits, debits, closing };
}

/** Daily closing balance across the given accounts for the last `days` days. */
export async function getBalanceSeries(db: DbClient, accounts: Account[], days: number, nowIso: string) {
  const end = localIsoDate(nowIso);
  const start = addDays(end, -days + 1);
  const ids = accounts.map((a) => a.id);
  if (!ids.length) return [];

  const [{ data: entries }, priors] = await Promise.all([
    db
      .from("ledger_entries")
      .select("account_id, balance_after_cents, created_at, id")
      .in("account_id", ids)
      .gte("created_at", localMidnightUtc(start).toISOString())
      .order("created_at")
      .order("id")
      .limit(5000),
    Promise.all(
      ids.map((id) =>
        db
          .from("ledger_entries")
          .select("balance_after_cents")
          .eq("account_id", id)
          .lt("created_at", localMidnightUtc(start).toISOString())
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
    ),
  ]);

  const last = new Map<string, number>();
  ids.forEach((id, i) => last.set(id, priors[i].data?.balance_after_cents ?? 0));
  const byDay = new Map<string, typeof entries>();
  for (const e of entries ?? []) {
    const d = localIsoDate(e.created_at);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }

  const series: { date: string; balance: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    for (const e of byDay.get(d) ?? []) last.set(e.account_id, e.balance_after_cents);
    series.push({ date: d, balance: [...last.values()].reduce((s, v) => s + v, 0) });
  }
  return series;
}

export async function getSpendingByCategory(db: DbClient, accountIds: string[], sinceIso: string) {
  if (!accountIds.length) return [];
  const { data, error } = await db
    .from("transactions")
    .select("category, amount_cents")
    .in("account_id", accountIds)
    .eq("status", "posted")
    .eq("direction", "debit")
    .in("kind", ["card_purchase", "bill_payment"])
    .gte("created_at", sinceIso)
    .limit(5000);
  if (error) throw error;
  const totals = new Map<string, number>();
  for (const t of data) totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount_cents);
  return [...totals.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export async function getMonthFlows(db: DbClient, accountIds: string[], monthStartIso: string) {
  if (!accountIds.length) return { income: 0, spending: 0 };
  const { data } = await db
    .from("account_activity")
    .select("signed_amount_cents, kind")
    .in("account_id", accountIds)
    .eq("status", "posted")
    .gte("created_at", monthStartIso)
    .limit(5000);
  let income = 0;
  let spending = 0;
  for (const r of data ?? []) {
    const v = r.signed_amount_cents ?? 0;
    if (v > 0 && r.kind !== "transfer") income += v;
    if (v < 0 && r.kind !== "transfer") spending += -v;
  }
  return { income, spending };
}

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Shopping",
  "Transport",
  "Entertainment",
  "Health",
  "Travel",
  "Bills & Utilities",
  "Transfers",
  "Income",
  "Interest",
  "Fees",
  "Other",
];

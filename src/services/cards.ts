import "server-only";
import type { DbClient } from "@/lib/supabase/server";

export async function listCards(db: DbClient, ownerId: string) {
  const { data, error } = await db
    .from("cards")
    .select("*, account:accounts(nickname, account_number, available_cents)")
    .eq("owner_id", ownerId)
    .order("status")
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function cardSpending(db: DbClient, cardIds: string[], nowIso: string) {
  if (!cardIds.length) return new Map<string, { today: number; month: number }>();
  const now = new Date(nowIso);
  const monthStart = new Date(now.getTime() - 32 * 86_400_000).toISOString();
  const { data } = await db
    .from("transactions")
    .select("card_id, amount_cents, created_at")
    .in("card_id", cardIds)
    .eq("status", "posted")
    .eq("kind", "card_purchase")
    .gte("created_at", monthStart);
  const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
  const fmtMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" });
  const today = fmtDay.format(now);
  const month = fmtMonth.format(now);
  const out = new Map<string, { today: number; month: number }>();
  for (const t of data ?? []) {
    const cur = out.get(t.card_id!) ?? { today: 0, month: 0 };
    const d = new Date(t.created_at);
    if (fmtDay.format(d) === today) cur.today += t.amount_cents;
    if (fmtMonth.format(d) === month) cur.month += t.amount_cents;
    out.set(t.card_id!, cur);
  }
  return out;
}

export async function recentCardTransactions(db: DbClient, cardIds: string[], limit = 12) {
  if (!cardIds.length) return [];
  const { data } = await db
    .from("transactions")
    .select("id, description, category, amount_cents, fee_cents, status, failure_reason, created_at, card_id, metadata")
    .in("card_id", cardIds)
    .eq("kind", "card_purchase")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function setCardLocked(db: DbClient, cardId: string, locked: boolean, reason?: string) {
  const { error } = await db.rpc("set_card_status", { p_card: cardId, p_locked: locked, p_reason: reason });
  if (error) throw error;
}

export type CardSettingsInput = {
  dailyLimitCents: number;
  monthlyLimitCents: number;
  online: boolean;
  contactless: boolean;
  international: boolean;
};

export async function updateCardSettings(db: DbClient, cardId: string, s: CardSettingsInput) {
  const { error } = await db.rpc("update_card_settings", {
    p_card: cardId,
    p_daily_limit: s.dailyLimitCents,
    p_monthly_limit: s.monthlyLimitCents,
    p_online: s.online,
    p_contactless: s.contactless,
    p_international: s.international,
  });
  if (error) throw error;
}

export async function replaceCard(db: DbClient, cardId: string) {
  const { data, error } = await db.rpc("replace_card", { p_card: cardId });
  if (error) throw error;
  return data as { card_id: string; fee_cents: number };
}

export async function simulatePurchase(
  db: DbClient,
  input: { cardId: string; amountCents: number; merchant: string; category: string; channel: string; international: boolean },
) {
  const { data, error } = await db.rpc("simulate_card_purchase", {
    p_card: input.cardId,
    p_amount: input.amountCents,
    p_merchant: input.merchant,
    p_category: input.category,
    p_channel: input.channel,
    p_international: input.international,
  });
  if (error) throw error;
  return data as { id: string; status: string; failure_reason?: string; fee_cents?: number };
}

import "server-only";
import type { DbClient } from "@/lib/supabase/server";

export async function listNotifications(db: DbClient, userId: string, limit = 20) {
  const [{ data }, { count }] = await Promise.all([
    db.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
  ]);
  return { items: data ?? [], unread: count ?? 0 };
}

export async function markAllRead(db: DbClient) {
  const { error } = await db.rpc("mark_notifications_read");
  if (error) throw error;
}

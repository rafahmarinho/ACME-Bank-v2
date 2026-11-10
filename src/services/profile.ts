import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import { SUPABASE_URL } from "@/lib/supabase/env";
import type { Preferences, Profile } from "@/lib/types";

export function avatarUrl(profile: Pick<Profile, "avatar_path" | "updated_at">) {
  if (!profile.avatar_path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_path}?v=${encodeURIComponent(profile.updated_at)}`;
}

export function preferencesOf(profile: Profile): Preferences {
  const p = (profile.preferences ?? {}) as Partial<Preferences>;
  return {
    email_alerts: p.email_alerts ?? true,
    push_alerts: p.push_alerts ?? true,
    low_balance_alert_cents: p.low_balance_alert_cents ?? 10000,
    large_transaction_alert_cents: p.large_transaction_alert_cents ?? 50000,
    marketing_emails: p.marketing_emails ?? false,
    theme: p.theme ?? "system",
  };
}

export async function updateContactDetails(
  db: DbClient,
  userId: string,
  input: { full_name: string; phone: string | null; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null },
) {
  const { error } = await db.from("profiles").update(input).eq("id", userId);
  if (error) throw error;
}

export async function updatePreferences(db: DbClient, userId: string, prefs: Preferences) {
  const { error } = await db.from("profiles").update({ preferences: prefs }).eq("id", userId);
  if (error) throw error;
}

export async function uploadAvatar(db: DbClient, userId: string, file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use a PNG, JPG or WebP image");
  if (file.size > 2 * 1024 * 1024) throw new Error("Images must be 2 MB or smaller");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/avatar.${ext}`;
  const { error } = await db.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { error: updError } = await db.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (updError) throw updError;
}

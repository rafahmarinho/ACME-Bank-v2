import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Current user + profile for this request (memoized per render). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;
  return { supabase, userId, profile };
});

export const isStaffRole = (p: Pick<Profile, "role">) => p.role === "support" || p.role === "admin";

export function homeFor(profile: Profile) {
  if (isStaffRole(profile)) return "/staff";
  return profile.kyc_status === "verified" ? "/dashboard" : "/open-account";
}

export async function requireSession() {
  const session = await getSession();
  // A valid JWT without a profile means the user no longer exists: clear the cookie to avoid redirect loops.
  if (!session) redirect("/auth/signout?reason=expired");
  return session;
}

/** Customer banking screens: verified customers only. */
export async function requireCustomer() {
  const session = await requireSession();
  if (isStaffRole(session.profile)) redirect("/staff");
  if (session.profile.kyc_status !== "verified") redirect("/open-account");
  return session;
}

export async function requireStaff() {
  const session = await requireSession();
  if (!isStaffRole(session.profile)) redirect("/dashboard");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.profile.role !== "admin") redirect("/staff");
  return session;
}

export const getSimNow = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("sim_now");
  return data ?? new Date().toISOString();
});

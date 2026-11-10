import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDemoUsers } from "@/lib/demo/users";

export const SCENARIOS = [
  {
    code: "baseline",
    title: "Baseline",
    mode: true,
    description: "Normal daily activity, standard settlement times and automatic identity checks. Clears any active modes.",
  },
  {
    code: "payday",
    title: "Payday",
    mode: false,
    description: "Posts salaries for every demo customer now. ACH client and card-sales deposits stay pending until the next day.",
  },
  {
    code: "pending_transfers",
    title: "Pending transfers",
    mode: false,
    description: "Creates ACH and wire transfers that remain pending until the clock advances, plus a $12,500 transfer held for staff review.",
  },
  {
    code: "insufficient_funds",
    title: "Insufficient funds",
    mode: true,
    description: "Sofia's rent payment and a card purchase are declined for lack of funds. Her spending stays elevated while active.",
  },
  {
    code: "shopping_spree",
    title: "Shopping spree",
    mode: true,
    description: "A burst of purchases on Olivia's card; one exceeds her daily card limit. Daily spending is higher while active.",
  },
  {
    code: "fraud_alert",
    title: "Fraud alert",
    mode: false,
    description: "Suspicious international purchases on Marcus's card are declined, the card is locked and an urgent ticket is opened.",
  },
  {
    code: "ach_delay",
    title: "ACH network delay",
    mode: true,
    description: "Simulates a slow clearing network: new ACH transfers take 4 days to settle instead of 2.",
  },
  {
    code: "manual_kyc",
    title: "Manual KYC review",
    mode: true,
    description: "New account applications wait in the staff review queue instead of being approved automatically.",
  },
] as const;

export async function getSimState(db: DbClient) {
  const [{ data: state }, { data: now }] = await Promise.all([
    db.from("sim_state").select("*").eq("id", 1).single(),
    db.rpc("sim_now"),
  ]);
  return { state: state!, now: now as string };
}

export async function advanceSimulation(db: DbClient, days: number) {
  const { data, error } = await db.rpc("sim_advance", { p_days: days });
  if (error) throw error;
  return data as { days: number; sim_now: string; settled: number; scheduled: number; activity: number };
}

export async function applyScenario(db: DbClient, code: string) {
  const { data, error } = await db.rpc("sim_apply_scenario", { p_code: code });
  if (error) throw error;
  return data as { scenario: string; message: string };
}

export async function processNow(db: DbClient) {
  const { data, error } = await db.rpc("sim_process_now");
  if (error) throw error;
  return data as { settled: number; scheduled: number };
}

export async function setAutoActivity(db: DbClient, enabled: boolean) {
  const { error } = await db.rpc("sim_set_auto_activity", { p_enabled: enabled });
  if (error) throw error;
}

/** Recreates demo users (service role) and regenerates two months of data. Caller must be an admin. */
export async function resetDemoData() {
  const admin = createAdminClient();
  await ensureDemoUsers(admin, process.env.DEMO_PASSWORD ?? "AcmeDemo!2026");
  const { data, error } = await admin.rpc("sim_reset_demo");
  if (error) throw error;
  return data as { transactions: number; from: string; to: string };
}

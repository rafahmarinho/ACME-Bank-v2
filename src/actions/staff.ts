"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireStaff } from "@/services/session";
import { advanceSimulation, applyScenario, processNow, resetDemoData, setAutoActivity } from "@/services/simulation";
import { type ActionResult, fail } from "@/lib/action-result";
import type { UserRole } from "@/lib/types";

const refreshAll = () => revalidatePath("/", "layout");

export async function reviewTransferAction(txnId: string, approve: boolean, note?: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireStaff();
    const { data, error } = await supabase.rpc("review_transfer", { p_txn: txnId, p_approve: approve, p_note: note });
    if (error) throw error;
    refreshAll();
    const status = (data as { status: string }).status;
    return {
      ok: true,
      message: approve
        ? status === "posted"
          ? "Transfer approved and posted."
          : "Transfer approved. It will settle when the clearing window passes."
        : "Transfer rejected and funds released.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function decideApplicationAction(appId: string, approve: boolean, note?: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireStaff();
    const { error } = await supabase.rpc("decide_application", { p_app: appId, p_approve: approve, p_note: note });
    if (error) throw error;
    refreshAll();
    return { ok: true, message: approve ? "Application approved — account opened." : "Application rejected." };
  } catch (e) {
    return fail(e);
  }
}

export async function setAccountStatusAction(
  accountId: string,
  status: "active" | "frozen" | "closed",
  reason?: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await requireStaff();
    const { error } = await supabase.rpc("set_account_status", { p_account: accountId, p_status: status, p_reason: reason });
    if (error) throw error;
    refreshAll();
    return { ok: true, message: `Account ${status === "active" ? "reactivated" : status}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function staffCardLockAction(cardId: string, locked: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireStaff();
    const { error } = await supabase.rpc("set_card_status", {
      p_card: cardId,
      p_locked: locked,
      p_reason: locked ? "Locked by ACME Support" : undefined,
    });
    if (error) throw error;
    refreshAll();
    return { ok: true, message: locked ? "Card locked." : "Card unlocked." };
  } catch (e) {
    return fail(e);
  }
}

export async function setUserRoleAction(userId: string, role: UserRole): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("set_user_role", { p_user: userId, p_role: role });
    if (error) throw error;
    refreshAll();
    return { ok: true, message: `Role changed to ${role}.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Simulation lab (admin)
// ---------------------------------------------------------------------------
export async function advanceSimulationAction(days: number): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const r = await advanceSimulation(supabase, days);
    refreshAll();
    return {
      ok: true,
      message: `Advanced ${r.days} day${r.days > 1 ? "s" : ""}: ${r.settled} settled, ${r.scheduled} scheduled payments, ${r.activity} customer actions.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function applyScenarioAction(code: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const r = await applyScenario(supabase, code);
    refreshAll();
    return { ok: true, message: r.message };
  } catch (e) {
    return fail(e);
  }
}

export async function processNowAction(): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const r = await processNow(supabase);
    refreshAll();
    return { ok: true, message: `Processed ${r.settled} settlements and ${r.scheduled} scheduled payments.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setAutoActivityAction(enabled: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    await setAutoActivity(supabase, enabled);
    refreshAll();
    return { ok: true, message: enabled ? "Automatic customer activity on." : "Automatic customer activity off." };
  } catch (e) {
    return fail(e);
  }
}

export async function resetDemoAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const r = await resetDemoData();
    refreshAll();
    return { ok: true, message: `Demo data reset: ${r.transactions} transactions generated since ${r.from}.` };
  } catch (e) {
    return fail(e);
  }
}

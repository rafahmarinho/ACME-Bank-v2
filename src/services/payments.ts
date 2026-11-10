import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import type { ScheduleFrequency } from "@/lib/types";

export async function listScheduledPayments(db: DbClient, ownerId: string) {
  const { data, error } = await db
    .from("scheduled_payments")
    .select(
      "*, from_account:accounts!scheduled_payments_from_account_id_fkey(nickname, account_number), to_account:accounts!scheduled_payments_to_account_id_fkey(nickname, account_number), beneficiary:beneficiaries(name, bank_name, account_number)",
    )
    .eq("owner_id", ownerId)
    .order("status")
    .order("next_run_date");
  if (error) throw error;
  return data;
}

export type ScheduleInput = {
  fromAccountId: string;
  beneficiaryId?: string | null;
  toAccountId?: string | null;
  description: string;
  amountCents: number;
  frequency: ScheduleFrequency;
  nextRunDate: string;
  endDate?: string | null;
};

export async function createScheduledPayment(db: DbClient, ownerId: string, input: ScheduleInput) {
  const { data, error } = await db
    .from("scheduled_payments")
    .insert({
      owner_id: ownerId,
      from_account_id: input.fromAccountId,
      beneficiary_id: input.beneficiaryId || null,
      to_account_id: input.toAccountId || null,
      description: input.description,
      amount_cents: input.amountCents,
      frequency: input.frequency,
      next_run_date: input.nextRunDate,
      end_date: input.endDate || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setScheduleStatus(db: DbClient, id: string, status: "active" | "paused" | "cancelled") {
  const { error } = await db.from("scheduled_payments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function runScheduleNow(db: DbClient, id: string) {
  const { data, error } = await db.rpc("run_scheduled_payment_now", { p_id: id });
  if (error) throw error;
  return data as { last_result: string; next_run_date: string; status: string };
}

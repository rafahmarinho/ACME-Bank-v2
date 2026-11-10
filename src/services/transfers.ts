import "server-only";
import type { DbClient } from "@/lib/supabase/server";
import type { TransferQuote, TransferRail, TransferResult } from "@/lib/types";

export type TransferInput = {
  fromAccountId: string;
  amountCents: number;
  rail: TransferRail;
  toAccountId?: string | null;
  beneficiaryId?: string | null;
  memo?: string | null;
  idempotencyKey?: string | null;
};

export async function quoteTransfer(db: DbClient, input: TransferInput): Promise<TransferQuote> {
  const { data, error } = await db.rpc("quote_transfer", {
    p_from: input.fromAccountId,
    p_amount: input.amountCents,
    p_rail: input.rail,
    p_to_account: input.toAccountId ?? undefined,
    p_beneficiary: input.beneficiaryId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as TransferQuote;
}

export async function createTransfer(db: DbClient, input: TransferInput): Promise<TransferResult> {
  const { data, error } = await db.rpc("create_transfer", {
    p_from: input.fromAccountId,
    p_amount: input.amountCents,
    p_rail: input.rail,
    p_to_account: input.toAccountId ?? undefined,
    p_beneficiary: input.beneficiaryId ?? undefined,
    p_memo: input.memo ?? undefined,
    p_idempotency_key: input.idempotencyKey ?? undefined,
  });
  if (error) throw error;
  return data as unknown as TransferResult;
}

export async function cancelTransfer(db: DbClient, txnId: string) {
  const { error } = await db.rpc("cancel_transfer", { p_txn: txnId });
  if (error) throw error;
}

export async function listTransfers(db: DbClient, accountIds: string[], status?: string, limit = 50) {
  if (!accountIds.length) return [];
  let query = db
    .from("transactions")
    .select("*, accounts!transactions_account_id_fkey(nickname, account_number)")
    .in("account_id", accountIds)
    .in("kind", ["transfer", "bill_payment"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status as "pending");
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listFees(db: DbClient) {
  const { data, error } = await db.from("fee_schedule").select("*").order("code");
  if (error) throw error;
  return data;
}

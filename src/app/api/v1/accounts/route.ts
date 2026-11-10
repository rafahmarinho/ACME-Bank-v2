import { NextResponse } from "next/server";
import { apiAuth, apiError } from "../../_lib/auth";
import { listAccounts } from "@/services/accounts";

/** GET /api/v1/accounts — the caller's accounts with balances in cents. */
export async function GET() {
  const auth = await apiAuth();
  if ("error" in auth) return auth.error;
  try {
    const accounts = await listAccounts(auth.supabase, auth.userId);
    return NextResponse.json({
      data: accounts.map((a) => ({
        id: a.id,
        type: a.type,
        nickname: a.nickname,
        account_number: a.account_number,
        routing_number: a.routing_number,
        status: a.status,
        currency: a.currency,
        balance_cents: a.balance_cents,
        available_cents: a.available_cents,
        pending_debits_cents: a.pending_debits_cents,
        daily_transfer_limit_cents: a.daily_transfer_limit_cents,
      })),
    });
  } catch (e) {
    return apiError(e, 500);
  }
}

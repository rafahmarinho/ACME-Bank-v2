import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiAuth, apiError } from "../../_lib/auth";
import { createTransfer, quoteTransfer } from "@/services/transfers";

const Body = z
  .object({
    from_account_id: z.uuid(),
    amount_cents: z.number().int().positive().max(10_000_000),
    rail: z.enum(["internal", "ach", "instant", "wire"]).default("ach"),
    to_account_id: z.uuid().optional(),
    beneficiary_id: z.uuid().optional(),
    memo: z.string().max(140).optional(),
    dry_run: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.to_account_id) !== Boolean(b.beneficiary_id), {
    message: "Provide exactly one of to_account_id or beneficiary_id",
  });

/**
 * POST /api/v1/transfers
 * Body: { from_account_id, amount_cents, rail?, to_account_id | beneficiary_id, memo?, dry_run? }
 * Header `Idempotency-Key` makes retries safe. `dry_run: true` returns the fee quote only.
 */
export async function POST(request: NextRequest) {
  const auth = await apiAuth();
  if ("error" in auth) return auth.error;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 422 });
  }
  const b = parsed.data;
  const input = {
    fromAccountId: b.from_account_id,
    amountCents: b.amount_cents,
    rail: b.rail,
    toAccountId: b.to_account_id,
    beneficiaryId: b.beneficiary_id,
    memo: b.memo,
    idempotencyKey: request.headers.get("idempotency-key")?.slice(0, 80) ?? undefined,
  };
  try {
    if (b.dry_run) return NextResponse.json({ data: await quoteTransfer(auth.supabase, input) });
    const result = await createTransfer(auth.supabase, input);
    return NextResponse.json({ data: result }, { status: result.status === "failed" ? 402 : 201 });
  } catch (e) {
    return apiError(e);
  }
}

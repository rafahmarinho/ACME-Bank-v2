import { NextResponse, type NextRequest } from "next/server";
import { apiAuth, apiError } from "../../../../_lib/auth";
import { getAccount, getActivity } from "@/services/accounts";

/**
 * GET /api/v1/accounts/:id/transactions?q=&status=&from=&to=&page=&page_size=
 * Lists account activity (newest first). Amounts are integer cents; signed_amount_cents is negative for debits.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/transactions">) {
  const auth = await apiAuth();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  try {
    const account = await getAccount(auth.supabase, id);
    if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("page_size") ?? 50)));
    const result = await getActivity(auth.supabase, {
      accountIds: [id],
      q: sp.get("q") ?? undefined,
      status: sp.get("status") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      page: Number(sp.get("page") ?? 1),
      pageSize,
    });
    return NextResponse.json({ data: result.rows, page: result.page, page_size: result.pageSize, total: result.total });
  } catch (e) {
    return apiError(e, 500);
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { createApiClient } from "@/lib/supabase/server";
import { buildStatement, statementToCsv, statementToPdf } from "@/services/statements";

/**
 * GET /api/statements?account=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD&format=pdf|csv
 * Authenticated by session cookie or `Authorization: Bearer <access token>`. RLS restricts
 * access to the caller's own accounts (staff can download any customer's statement).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const account = sp.get("account") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const format = sp.get("format") === "csv" ? "csv" : "pdf";
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

  if (!/^[0-9a-f-]{36}$/i.test(account) || !isDate(from) || !isDate(to) || from > to) {
    return NextResponse.json({ error: "Provide account, from and to (YYYY-MM-DD) with from <= to" }, { status: 400 });
  }

  const supabase = await createApiClient();
  const { data: user } = await supabase.auth.getClaims();
  if (!user?.claims?.sub) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statement = await buildStatement(supabase, account, from, to);
  if (!statement) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const filename = `acme-statement-${statement.account.account_number.slice(-4)}-${from}-to-${to}.${format}`;
  if (format === "csv") {
    return new NextResponse(statementToCsv(statement), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const pdf = await statementToPdf(statement);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

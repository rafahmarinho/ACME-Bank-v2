import type { Metadata } from "next";
import Form from "next/form";
import { FileSpreadsheet, FileText } from "lucide-react";
import { requireCustomer, getSimNow } from "@/services/session";
import { listAccounts } from "@/services/accounts";
import { buildStatement } from "@/services/statements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Money, PageHeader } from "@/components/common/display";
import { NativeSelect } from "@/components/common/forms";
import { addDays, formatCents, formatDate, formatPlainDate, localIsoDate } from "@/lib/format";
import Link from "next/link";

export const metadata: Metadata = { title: "Statements" };

function monthRanges(today: string, count: number) {
  const out: { label: string; from: string; to: string }[] = [];
  const [y, m] = today.split("-").map(Number);
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const from = d.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    out.push({
      label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d) + (i === 0 ? " (to date)" : ""),
      from,
      to: end > today ? today : end,
    });
  }
  return out;
}

export default async function StatementsPage({ searchParams }: PageProps<"/statements">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireCustomer();
  const [accounts, now] = await Promise.all([listAccounts(supabase, userId), getSimNow()]);
  const today = localIsoDate(now);
  const accountId = typeof sp.account === "string" && accounts.some((a) => a.id === sp.account) ? sp.account : accounts[0]?.id;
  const from = typeof sp.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : addDays(today, -30);
  const to = typeof sp.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;
  const invalid = from > to;
  const statement = accountId && !invalid ? await buildStatement(supabase, accountId, from, to) : null;
  const qs = new URLSearchParams({ account: accountId ?? "", from, to });
  const months = monthRanges(today, 3);

  return (
    <div>
      <PageHeader title="Statements" description="Download statements for any period as PDF or CSV. Only posted transactions are included." />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Statement period</CardTitle>
            <CardDescription>Choose an account and a date range.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form action="/statements" className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="account">Account</Label>
                <NativeSelect id="account" name="account" defaultValue={accountId}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nickname} ••{a.account_number.slice(-4)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from">From</Label>
                  <Input id="from" type="date" name="from" defaultValue={from} max={today} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">To</Label>
                  <Input id="to" type="date" name="to" defaultValue={to} max={today} />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Preview statement
              </Button>
            </Form>
            <div className="space-y-1.5 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">Monthly statements</p>
              {months.map((m) => (
                <Link
                  key={m.from}
                  href={`/statements?${new URLSearchParams({ account: accountId ?? "", from: m.from, to: m.to })}`}
                  className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {invalid && <EmptyState title="Invalid period" description="The start date must be before the end date." />}
          {statement && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {statement.account.nickname} ••{statement.account.account_number.slice(-4)}
                  </CardTitle>
                  <CardDescription>
                    {formatPlainDate(from)} – {formatPlainDate(to)} · {statement.entries.length} entries
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      ["Opening balance", statement.opening],
                      ["Total credits", statement.credits],
                      ["Total debits", statement.debits],
                      ["Closing balance", statement.closing],
                    ].map(([k, v]) => (
                      <div key={k as string} className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="mt-1 font-semibold tabular">{formatCents(v as number)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/statements?${qs}&format=pdf`} className={buttonVariants()} download>
                      <FileText /> Download PDF
                    </a>
                    <a href={`/api/statements?${qs}&format=csv`} className={buttonVariants({ variant: "outline" })} download>
                      <FileSpreadsheet /> Download CSV
                    </a>
                  </div>
                </CardContent>
              </Card>
              <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statement.entries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No posted transactions in this period.
                        </TableCell>
                      </TableRow>
                    )}
                    {statement.entries.slice(0, 100).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                        <TableCell className="max-w-72 truncate">{e.memo}</TableCell>
                        <TableCell className="text-right">{e.direction === "debit" && <Money cents={e.amount_cents} />}</TableCell>
                        <TableCell className="text-right text-success">{e.direction === "credit" && <Money cents={e.amount_cents} />}</TableCell>
                        <TableCell className="text-right font-medium">
                          <Money cents={e.balance_after_cents} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {statement.entries.length > 100 && (
                  <p className="border-t px-4 py-2 text-xs text-muted-foreground">Showing the first 100 entries. Download the statement for the full list.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, Download, SearchX } from "lucide-react";
import { requireCustomer, getSimNow } from "@/services/session";
import { CATEGORIES, getAccount, getActivity, getLedger } from "@/services/accounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DefinitionList, EmptyState, Money, PageHeader, StatusBadge } from "@/components/common/display";
import { FilterBar, Pagination } from "@/components/common/list-controls";
import { ActivityList, KIND_OPTIONS, STATUS_OPTIONS } from "@/components/banking/activity-list";
import { DepositForm, TransferLimitForm } from "@/components/banking/account-forms";
import { addDays, formatCents, formatDate, formatDateTime, localIsoDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Account details" };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export default async function AccountDetailPage({ params, searchParams }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, userId } = await requireCustomer();
  const account = await getAccount(supabase, id);
  if (!account || account.owner_id !== userId) notFound();

  const tab = str(sp.tab) ?? "activity";
  const now = await getSimNow();
  const today = localIsoDate(now);
  const filters = {
    tab,
    q: str(sp.q),
    status: str(sp.status),
    kind: str(sp.kind),
    category: str(sp.category),
    from: str(sp.from),
    to: str(sp.to),
    page: str(sp.page),
  };

  const tabs = [
    { key: "activity", label: "Activity" },
    { key: "ledger", label: "Ledger (debits & credits)" },
    { key: "details", label: "Details & limits" },
  ];

  return (
    <div>
      <Link href="/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All accounts
      </Link>
      <PageHeader
        eyebrow={`${account.type} ••${account.account_number.slice(-4)}`}
        title={account.nickname}
        description={account.status !== "active" ? `This account is ${account.status}${account.status_reason ? `: ${account.status_reason}` : ""}.` : undefined}
        actions={
          <>
            <Link href={`/transfers?from=${account.id}`} className={buttonVariants()}>
              <ArrowLeftRight /> Transfer
            </Link>
            <Link href={`/statements?account=${account.id}`} className={buttonVariants({ variant: "outline" })}>
              <Download /> Statement
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Current balance</p>
          <p className="mt-1 text-2xl font-semibold tabular">{formatCents(account.balance_cents)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Available</p>
          <p className="mt-1 text-2xl font-semibold tabular text-primary dark:text-white">{formatCents(account.available_cents)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">On hold (pending debits)</p>
          <p className="mt-1 text-2xl font-semibold tabular">{formatCents(account.pending_debits_cents)}</p>
        </div>
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b" aria-label="Account sections">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/accounts/${id}?tab=${t.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              tab === t.key ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "activity" && <ActivityTab id={id} filters={filters} />}
      {tab === "ledger" && <LedgerTab id={id} from={filters.from ?? addDays(today, -30)} to={filters.to ?? today} />}
      {tab === "details" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Account details</CardTitle>
              <CardDescription>Use these to receive direct deposits and transfers.</CardDescription>
            </CardHeader>
            <CardContent>
              <DefinitionList
                items={[
                  ["Account number", <span key="n" className="font-mono">{account.account_number}</span>],
                  ["Routing number", <span key="r" className="font-mono">{account.routing_number}</span>],
                  ["Type", <span key="t" className="capitalize">{account.type}</span>],
                  ["Status", <StatusBadge key="s" status={account.status} />],
                  ["Interest rate", account.interest_rate_bps ? `${(account.interest_rate_bps / 100).toFixed(2)}% APY` : "—"],
                  ["Opened", formatDate(account.opened_at)],
                ]}
              />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transfer limit</CardTitle>
                <CardDescription>Protects you if your credentials are ever compromised.</CardDescription>
              </CardHeader>
              <CardContent>
                <TransferLimitForm accountId={account.id} limitCents={account.daily_transfer_limit_cents} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Add money (simulation)</CardTitle>
                <CardDescription>Simulates an incoming deposit from outside ACME Bank.</CardDescription>
              </CardHeader>
              <CardContent>
                <DepositForm accountId={account.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );

  async function ActivityTab({ id, filters }: { id: string; filters: Record<string, string | undefined> }) {
    const activity = await getActivity(supabase, {
      accountIds: [id],
      q: filters.q,
      status: filters.status,
      kind: filters.kind,
      category: filters.category,
      from: filters.from,
      to: filters.to,
      page: Number(filters.page ?? 1),
    });
    return (
      <div className="space-y-4">
        <FilterBar
          action={`/accounts/${id}`}
          hidden={{ tab: "activity" }}
          values={filters}
          searchPlaceholder="Search this account"
          filters={[
            { type: "select", name: "status", label: "Status", options: STATUS_OPTIONS },
            { type: "select", name: "kind", label: "Type", options: KIND_OPTIONS },
            { type: "select", name: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
            { type: "date", name: "from", label: "From" },
            { type: "date", name: "to", label: "To" },
          ]}
        />
        {activity.rows.length ? (
          <>
            <ActivityList rows={activity.rows} />
            <Pagination basePath={`/accounts/${id}`} params={filters} page={activity.page} pageSize={activity.pageSize} total={activity.total} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="No transactions found" description="Adjust the filters to see more activity." />
        )}
      </div>
    );
  }

  async function LedgerTab({ id, from, to }: { id: string; from: string; to: string }) {
    const ledger = await getLedger(supabase, id, from, to);
    return (
      <div className="space-y-4">
        <FilterBar action={`/accounts/${id}`} hidden={{ tab: "ledger" }} values={{ from, to }} searchPlaceholder="Ledger shows posted entries only" filters={[{ type: "date", name: "from", label: "From" }, { type: "date", name: "to", label: "To" }]} />
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Opening balance", ledger.opening],
            ["Credits", ledger.credits],
            ["Debits", ledger.debits],
            ["Closing balance", ledger.closing],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-1 font-semibold tabular">{formatCents(v as number)}</p>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden md:table-cell">Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No posted entries in this period.
                  </TableCell>
                </TableRow>
              )}
              {[...ledger.entries].reverse().map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell className="max-w-64 truncate">{e.memo}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{e.transactions?.reference}</TableCell>
                  <TableCell className="text-right">{e.direction === "debit" ? <Money cents={e.amount_cents} /> : ""}</TableCell>
                  <TableCell className="text-right text-success">{e.direction === "credit" ? <Money cents={e.amount_cents} /> : ""}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Money cents={e.balance_after_cents} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
}

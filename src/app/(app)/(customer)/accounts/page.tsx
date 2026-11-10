import type { Metadata } from "next";
import Link from "next/link";
import { PiggyBank, SearchX, Wallet } from "lucide-react";
import { requireCustomer } from "@/services/session";
import { CATEGORIES, getActivity, listAccounts } from "@/services/accounts";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { FilterBar, Pagination } from "@/components/common/list-controls";
import { ActivityList, KIND_OPTIONS, STATUS_OPTIONS } from "@/components/banking/activity-list";
import { OpenAccountDialog } from "@/components/banking/account-forms";
import { formatCents, maskAccount } from "@/lib/format";

export const metadata: Metadata = { title: "Accounts" };

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  const { supabase, userId } = await requireCustomer();
  const sp = await searchParams;
  const params = {
    q: str(sp.q),
    account: str(sp.account),
    status: str(sp.status),
    kind: str(sp.kind),
    category: str(sp.category),
    direction: str(sp.direction),
    from: str(sp.from),
    to: str(sp.to),
    page: str(sp.page),
  };
  const accounts = await listAccounts(supabase, userId);
  const ids = params.account ? accounts.filter((a) => a.id === params.account).map((a) => a.id) : accounts.map((a) => a.id);
  const activity = await getActivity(supabase, {
    accountIds: ids,
    q: params.q,
    status: params.status,
    kind: params.kind,
    category: params.category,
    direction: params.direction as "debit" | "credit" | undefined,
    from: params.from,
    to: params.to,
    page: Number(params.page ?? 1),
  });
  const names = Object.fromEntries(accounts.map((a) => [a.id, a.nickname]));

  return (
    <div>
      <PageHeader title="Accounts & activity" description="Balances, transactions and account details." actions={<OpenAccountDialog />} />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Link key={a.id} href={`/accounts/${a.id}`} className="rounded-xl border bg-card p-4 transition hover:border-brand/50 hover:shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-accent p-2 text-accent-foreground">
                  {a.type === "savings" ? <PiggyBank className="size-4" /> : <Wallet className="size-4" />}
                </span>
                <div>
                  <p className="text-sm font-medium">{a.nickname}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {a.type} {maskAccount(a.account_number)}
                  </p>
                </div>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-4 text-2xl font-semibold tabular">{formatCents(a.balance_cents)}</p>
            <p className="text-xs text-muted-foreground">
              Available {formatCents(a.available_cents)} · Limit {formatCents(a.daily_transfer_limit_cents)}/day
            </p>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 font-semibold">All transactions</h2>
      <FilterBar
        action="/accounts"
        values={params}
        searchPlaceholder="Search description, merchant or reference"
        filters={[
          { type: "select", name: "account", label: "Account", options: accounts.map((a) => ({ value: a.id, label: a.nickname })) },
          { type: "select", name: "direction", label: "Direction", options: [{ value: "credit", label: "Money in" }, { value: "debit", label: "Money out" }] },
          { type: "select", name: "status", label: "Status", options: STATUS_OPTIONS },
          { type: "select", name: "kind", label: "Type", options: KIND_OPTIONS },
          { type: "select", name: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
          { type: "date", name: "from", label: "From" },
          { type: "date", name: "to", label: "To" },
        ]}
      />
      <div className="mt-4">
        {activity.rows.length ? (
          <>
            <ActivityList rows={activity.rows} accountNames={accounts.length > 1 ? names : undefined} />
            <Pagination basePath="/accounts" params={params} page={activity.page} pageSize={activity.pageSize} total={activity.total} />
          </>
        ) : (
          <EmptyState icon={SearchX} title="No transactions match your filters" description="Try a different search term or widen the date range." />
        )}
      </div>
    </div>
  );
}

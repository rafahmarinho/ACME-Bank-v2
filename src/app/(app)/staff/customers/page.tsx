import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { requireStaff } from "@/services/session";
import { listCustomers } from "@/services/staff";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/common/display";
import { FilterBar } from "@/components/common/list-controls";
import { formatCents, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/staff/customers">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const kyc = typeof sp.kyc === "string" && sp.kyc ? sp.kyc : undefined;
  const { supabase } = await requireStaff();
  const customers = await listCustomers(supabase, q, kyc);

  return (
    <div>
      <PageHeader title="Customers" description={`${customers.length} customer profiles`} />
      <FilterBar
        action="/staff/customers"
        values={{ q, kyc }}
        searchPlaceholder="Search name, email or customer number"
        filters={[
          {
            type: "select",
            name: "kyc",
            label: "Identity",
            options: [
              { value: "verified", label: "Verified" },
              { value: "pending_review", label: "In review" },
              { value: "not_started", label: "Not started" },
              { value: "rejected", label: "Rejected" },
            ],
          },
        ]}
      />
      <div className="mt-4">
        {customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Number</TableHead>
                  <TableHead>Identity</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Accounts</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="hidden lg:table-cell">Since</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => {
                  const accts = (c.accounts ?? []).filter((a) => !a.is_system);
                  return (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/staff/customers/${c.id}`} className="block">
                          <span className="block font-medium">{c.full_name}</span>
                          <span className="block text-xs text-muted-foreground">{c.email}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">{c.customer_number ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.kyc_status} />
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {accts.length}
                        {accts.some((a) => a.status === "frozen") && <span className="ml-1 text-xs text-chart-3">(frozen)</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular">{formatCents(accts.reduce((s, a) => s + a.balance_cents, 0))}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(c.created_at)}</TableCell>
                      <TableCell>
                        <Link href={`/staff/customers/${c.id}`} aria-label={`Open ${c.full_name}`}>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

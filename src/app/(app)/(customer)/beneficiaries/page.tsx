import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Send, Star, Trash2, Users } from "lucide-react";
import { requireCustomer } from "@/services/session";
import { listBeneficiaries } from "@/services/beneficiaries";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/common/display";
import { ActionButton } from "@/components/common/forms";
import { FilterBar } from "@/components/common/list-controls";
import { BeneficiaryDialog } from "@/components/banking/beneficiary-dialog";
import { deleteBeneficiaryAction } from "@/actions/banking";
import { initials } from "@/lib/format";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage({ searchParams }: PageProps<"/beneficiaries">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const { supabase, userId } = await requireCustomer();
  const all = await listBeneficiaries(supabase, userId);
  const list = all.filter(
    (b) =>
      (!q || [b.name, b.nickname, b.bank_name, b.account_number].some((v) => v?.toLowerCase().includes(q))) &&
      (!type || (type === "acme" ? b.internal_account_id : !b.internal_account_id)),
  );

  return (
    <div>
      <PageHeader title="Beneficiaries" description="People and businesses you pay. ACME customers receive money instantly." actions={<BeneficiaryDialog />} />
      <FilterBar
        action="/beneficiaries"
        values={{ q: q || undefined, type: type || undefined }}
        searchPlaceholder="Search by name, bank or account"
        filters={[{ type: "select", name: "type", label: "Bank", options: [{ value: "acme", label: "ACME Bank" }, { value: "external", label: "Other banks" }] }]}
      />
      <div className="mt-4">
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title={all.length ? "No beneficiaries match" : "No beneficiaries yet"}
            description={all.length ? "Try a different search." : "Add someone to start sending money."}
            action={all.length ? undefined : <BeneficiaryDialog />}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {initials(b.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {b.name}
                    {b.is_favorite && <Star className="size-3.5 fill-brand text-brand" />}
                    {b.internal_account_id && <Badge className="bg-brand/15 text-accent-foreground">ACME</Badge>}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Building2 className="size-3" /> {b.bank_name} ••{b.account_number.slice(-4)}
                    {b.nickname && b.nickname !== "p2p" ? ` · ${b.nickname}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/transfers?to=beneficiary:${b.id}`} className={buttonVariants({ size: "sm" })}>
                    <Send /> Pay
                  </Link>
                  <BeneficiaryDialog beneficiary={b} />
                  <ActionButton
                    variant="ghost"
                    size="icon-sm"
                    action={deleteBeneficiaryAction.bind(null, b.id)}
                    confirm={{
                      title: `Remove ${b.name}?`,
                      description: "Past transactions stay in your history. You can add this beneficiary again later.",
                      confirmLabel: "Remove",
                      destructive: true,
                    }}
                  >
                    <Trash2 className="text-destructive" />
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

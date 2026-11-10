import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, XCircle } from "lucide-react";
import { isStaffRole, requireSession } from "@/services/session";
import { PageHeader } from "@/components/common/display";
import { OpenAccountWizard } from "@/components/account/open-account-wizard";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Open an account" };

export default async function OpenAccountPage() {
  const { supabase, profile, userId } = await requireSession();
  if (isStaffRole(profile)) redirect("/staff");
  if (profile.kyc_status === "verified") redirect("/dashboard");

  const { data: app } = await supabase
    .from("account_applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profile.kyc_status === "pending_review" && app?.status === "pending_review") {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <Clock className="mx-auto mb-4 size-12 text-warning" />
        <h1 className="text-2xl font-semibold">Your application is being reviewed</h1>
        <p className="mt-2 text-muted-foreground">
          Submitted {formatDateTime(app.created_at)}. Our team verifies applications within one business day. We&apos;ll notify you here as soon as there&apos;s a decision.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {profile.kyc_status === "rejected" && (
        <div className="mb-6 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm">
          <XCircle className="size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Your previous application was not approved</p>
            <p className="text-muted-foreground">{app?.decision_note ?? "Please double-check your details and try again."}</p>
          </div>
        </div>
      )}
      <PageHeader
        eyebrow="Step 2 of 2"
        title="Open your ACME account"
        description="We'll verify your identity instantly in most cases. This is a simulation — don't enter real personal data."
      />
      <OpenAccountWizard
        defaults={{
          full_name: profile.full_name,
          phone: profile.phone ?? "",
          address_line1: profile.address_line1 ?? "",
          city: profile.city ?? "",
          state: profile.state ?? "",
          postal_code: profile.postal_code ?? "",
        }}
      />
    </div>
  );
}

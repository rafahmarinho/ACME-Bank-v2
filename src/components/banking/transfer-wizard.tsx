"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Loader2, Send, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, MoneyInput, NativeSelect } from "@/components/common/forms";
import { DefinitionList } from "@/components/common/display";
import { createTransferAction, quoteTransferAction } from "@/actions/banking";
import { formatCents, parseMoneyToCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TransferQuote, TransferResult } from "@/lib/types";

type AccountOpt = { id: string; nickname: string; last4: string; available: number; status: string };
type BeneficiaryOpt = { id: string; name: string; bank: string; last4: string; internal: boolean };

const RAILS = [
  { value: "ach", label: "Standard ACH", hint: "Free · 1–2 business days" },
  { value: "instant", label: "Instant", hint: "1.5% (min $0.50, max $15)" },
  { value: "wire", label: "Wire", hint: "$25 · next business day" },
] as const;

export function TransferWizard({
  accounts,
  beneficiaries,
  defaultFrom,
  defaultDestination,
}: {
  accounts: AccountOpt[];
  beneficiaries: BeneficiaryOpt[];
  defaultFrom?: string;
  defaultDestination?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [from, setFrom] = useState(defaultFrom ?? accounts.find((a) => a.status === "active")?.id ?? "");
  const [destination, setDestination] = useState(defaultDestination ?? "");
  const [amount, setAmount] = useState("");
  const [rail, setRail] = useState<string>("ach");
  const [memo, setMemo] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<TransferQuote | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();

  const source = accounts.find((a) => a.id === from);
  const destLabel = useMemo(() => {
    const [type, id] = destination.split(":");
    if (type === "account") {
      const a = accounts.find((x) => x.id === id);
      return a ? `${a.nickname} ••${a.last4}` : "";
    }
    const b = beneficiaries.find((x) => x.id === id);
    return b ? `${b.name} · ${b.bank} ••${b.last4}` : "";
  }, [destination, accounts, beneficiaries]);
  const destIsInternal =
    destination.startsWith("account:") || beneficiaries.find((b) => `beneficiary:${b.id}` === destination)?.internal;

  const review = () => {
    const errs: Record<string, string> = {};
    if (!from) errs.from = "Choose an account";
    if (!destination) errs.destination = "Choose who you're paying";
    const cents = parseMoneyToCents(amount);
    if (!cents) errs.amount = "Enter an amount like 125.50";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    start(async () => {
      const r = await quoteTransferAction({ from, destination, amount, rail: destIsInternal ? "internal" : rail });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setQuote(r.data!);
      setStep("review");
    });
  };

  const confirm = () =>
    start(async () => {
      const r = await createTransferAction({ from, destination, amount, rail: destIsInternal ? "internal" : rail, memo, idempotency_key: key });
      if (!r.ok) {
        setFailure(r.error);
        setResult(null);
      } else {
        setResult(r.data!);
        setFailure(null);
      }
      setStep("done");
      router.refresh();
    });

  const reset = () => {
    setStep("form");
    setAmount("");
    setMemo("");
    setQuote(null);
    setResult(null);
    setFailure(null);
    setKey(crypto.randomUUID());
  };

  if (step === "done") {
    const ok = !failure && result;
    const isPending = result?.status === "pending";
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-10 text-center">
          {ok ? (
            isPending ? (
              <Clock className="mb-3 size-12 text-warning" />
            ) : (
              <CheckCircle2 className="mb-3 size-12 text-success" />
            )
          ) : (
            <XCircle className="mb-3 size-12 text-destructive" />
          )}
          <h2 className="text-xl font-semibold">
            {ok ? (isPending ? (result.requires_review ? "Transfer submitted for review" : "Transfer scheduled") : "Money sent") : "Transfer not completed"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {ok
              ? isPending
                ? result.requires_review
                  ? "Transfers of $10,000 or more are reviewed by our team. The funds are on hold until a decision is made."
                  : `The funds are on hold and will settle ${quote?.eta.toLowerCase()}. You can cancel it until then.`
                : `${formatCents(parseMoneyToCents(amount))} is on its way to ${destLabel}.`
              : failure}
          </p>
          {result && <p className="mt-3 font-mono text-xs text-muted-foreground">Reference {result.reference}</p>}
          <div className="mt-6 flex gap-2">
            <Button onClick={reset}>Make another transfer</Button>
            <Link href={`/accounts/${from}`} className={buttonVariants({ variant: "outline" })}>
              View account
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "review" && quote) {
    const cents = parseMoneyToCents(amount) ?? 0;
    const blocked = !quote.sufficient_funds || !quote.within_limit;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review and confirm</CardTitle>
          <CardDescription>Check the details below. Fees are final once you confirm.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">You&apos;re sending</p>
            <p className="text-3xl font-semibold tabular">{formatCents(cents)}</p>
            <p className="mt-1 text-sm text-muted-foreground">to {destLabel}</p>
          </div>
          <DefinitionList
            items={[
              ["From", `${source?.nickname} ••${source?.last4}`],
              ["Method", quote.internal ? "ACME transfer (instant)" : RAILS.find((r) => r.value === quote.rail)?.label ?? quote.rail],
              ["Transfer fee", quote.fee_cents ? formatCents(quote.fee_cents) : <span key="f" className="text-success">Free</span>],
              ["Total debited", <span key="t" className="font-semibold">{formatCents(quote.total_cents)}</span>],
              ["Arrives", quote.eta],
              ["Available after", formatCents(quote.available_cents - quote.total_cents)],
              ...(quote.limit_remaining_cents != null
                ? ([["Daily limit remaining", formatCents(quote.limit_remaining_cents)]] as [string, React.ReactNode][])
                : []),
              ...(memo ? ([["Memo", memo]] as [string, React.ReactNode][]) : []),
            ]}
          />
          {quote.requires_review && (
            <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <ShieldAlert className="size-4 shrink-0 text-amber-600" />
              Transfers of $10,000 or more are held for a quick security review before they are sent.
            </p>
          )}
          {!quote.sufficient_funds && (
            <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              Insufficient funds: you have {formatCents(quote.available_cents)} available. If you continue, the transfer will be declined.
            </p>
          )}
          {!quote.within_limit && (
            <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              This exceeds your daily transfer limit. You can raise it in the account&apos;s Details &amp; limits tab.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep("form")} disabled={pending}>
              <ArrowLeft /> Edit
            </Button>
            <Button size="lg" onClick={confirm} disabled={pending || !quote.within_limit} className="bg-brand text-brand-foreground hover:bg-brand/90">
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              {blocked && quote.within_limit ? "Try anyway" : `Confirm ${formatCents(quote.total_cents)}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New transfer</CardTitle>
        <CardDescription>Move money between your accounts or pay a beneficiary.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="From" name="from" error={errors.from}>
          <NativeSelect id="f-from" value={from} onChange={(e) => setFrom(e.target.value)} error={errors.from}>
            <option value="">Choose an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} disabled={a.status !== "active"}>
                {a.nickname} ••{a.last4} — {formatCents(a.available)} available{a.status !== "active" ? ` (${a.status})` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="To" name="destination" error={errors.destination}>
          <NativeSelect id="f-destination" value={destination} onChange={(e) => setDestination(e.target.value)} error={errors.destination}>
            <option value="">Choose a recipient</option>
            <optgroup label="My accounts">
              {accounts
                .filter((a) => a.id !== from)
                .map((a) => (
                  <option key={a.id} value={`account:${a.id}`}>
                    {a.nickname} ••{a.last4}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Beneficiaries">
              {beneficiaries.map((b) => (
                <option key={b.id} value={`beneficiary:${b.id}`}>
                  {b.name} — {b.bank} ••{b.last4}
                  {b.internal ? " (ACME)" : ""}
                </option>
              ))}
            </optgroup>
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            Paying someone new?{" "}
            <Link href="/beneficiaries" className="font-medium text-primary underline-offset-2 hover:underline dark:text-brand">
              Add a beneficiary
            </Link>
          </p>
        </Field>
        <Field label="Amount" name="amount" error={errors.amount}>
          <MoneyInput name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
          {source && <p className="text-xs text-muted-foreground">Available: {formatCents(source.available)}</p>}
        </Field>
        {destination && !destIsInternal && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">Delivery speed</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {RAILS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 text-sm transition",
                    rail === r.value ? "border-brand bg-accent/50 ring-1 ring-brand" : "hover:bg-muted/50",
                  )}
                >
                  <input type="radio" name="rail" value={r.value} checked={rail === r.value} onChange={() => setRail(r.value)} className="sr-only" />
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {destination && destIsInternal && (
          <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">ACME-to-ACME transfers are instant and free.</p>
        )}
        <Field label="Memo (optional)" name="memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={140} placeholder="What's it for?" />
        <FieldError message={errors.form} />
        <Button size="lg" className="w-full" onClick={review} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Review transfer
        </Button>
      </CardContent>
    </Card>
  );
}

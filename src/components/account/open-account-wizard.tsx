"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, PiggyBank, Wallet } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FormMessage, MoneyInput, NativeSelect, SubmitButton } from "@/components/common/forms";
import { submitApplicationAction } from "@/actions/banking";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "About you", fields: ["full_name", "date_of_birth", "phone"] },
  { title: "Address", fields: ["address_line1", "city", "state", "postal_code"] },
  { title: "Identity", fields: ["ssn_last4", "employment_status", "annual_income"] },
  { title: "Your account", fields: ["account_type", "initial_deposit", "consent"] },
];

type Defaults = { full_name: string; phone: string; address_line1: string; city: string; state: string; postal_code: string };

export function OpenAccountWizard({ defaults }: { defaults: Defaults }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<"checking" | "savings">("checking");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult<{ status: string }> | null, FormData>(submitApplicationAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  // Jump to the first step with a server-side validation error (adjusting state during render).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    const idx = fe ? STEPS.findIndex((s) => s.fields.some((f) => fe[f])) : -1;
    if (idx >= 0) setStep(idx);
  }

  if (state?.ok) {
    const approved = state.data?.status === "approved";
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        {approved ? <CheckCircle2 className="mx-auto mb-3 size-12 text-success" /> : <Clock className="mx-auto mb-3 size-12 text-warning" />}
        <h2 className="text-xl font-semibold">{approved ? "Your account is open!" : "Application received"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {approved
            ? "We verified your identity instantly. Your debit card is ready to use in the app."
            : "We need a moment to verify a few details. You'll get a notification as soon as our team reviews your application."}
        </p>
        {approved && (
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
            Go to my accounts <ArrowRight />
          </Link>
        )}
      </div>
    );
  }

  const next = () => {
    const inputs = STEPS[step].fields
      .map((f) => formRef.current?.querySelector<HTMLInputElement>(`[name="${f}"]`))
      .filter(Boolean) as HTMLInputElement[];
    const invalid = inputs.find((i) => !i.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  return (
    <form ref={formRef} action={action} className="space-y-6" noValidate>
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="space-y-1.5">
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-muted")} />
            <p className={cn("hidden text-xs sm:block", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{s.title}</p>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">{STEPS[step].title}</h2>

        <div className={cn("grid gap-4 sm:grid-cols-2", step !== 0 && "hidden")}>
          <Field label="Legal full name" name="full_name" defaultValue={defaults.full_name} required minLength={2} error={fe?.full_name} className="sm:col-span-2" />
          <Field label="Date of birth" name="date_of_birth" type="date" required error={fe?.date_of_birth} />
          <Field label="Mobile phone" name="phone" defaultValue={defaults.phone} required placeholder="(555) 010-1234" error={fe?.phone} />
        </div>

        <div className={cn("grid gap-4 sm:grid-cols-2", step !== 1 && "hidden")}>
          <Field label="Street address" name="address_line1" defaultValue={defaults.address_line1} required error={fe?.address_line1} className="sm:col-span-2" />
          <Field label="City" name="city" defaultValue={defaults.city} required error={fe?.city} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" name="state" defaultValue={defaults.state} required maxLength={2} pattern="[A-Za-z]{2}" placeholder="NY" error={fe?.state} />
            <Field label="ZIP" name="postal_code" defaultValue={defaults.postal_code} required pattern="\d{5}(-\d{4})?" error={fe?.postal_code} />
          </div>
        </div>

        <div className={cn("grid gap-4 sm:grid-cols-2", step !== 2 && "hidden")}>
          <Field
            label="Last 4 digits of SSN"
            name="ssn_last4"
            inputMode="numeric"
            required
            maxLength={4}
            pattern="\d{4}"
            error={fe?.ssn_last4}
            hint="Simulated check — use 0000 to trigger a manual review."
          />
          <Field label="Employment status" name="employment_status">
            <NativeSelect name="employment_status" id="f-employment_status" defaultValue="employed">
              <option value="employed">Employed</option>
              <option value="self_employed">Self-employed</option>
              <option value="student">Student</option>
              <option value="retired">Retired</option>
              <option value="unemployed">Not employed</option>
            </NativeSelect>
          </Field>
          <Field label="Annual income (optional)" name="annual_income" error={fe?.annual_income}>
            <MoneyInput name="annual_income" error={fe?.annual_income} />
          </Field>
        </div>

        <div className={cn("space-y-4", step !== 3 && "hidden")}>
          <input type="hidden" name="account_type" value={type} />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { v: "checking" as const, icon: Wallet, title: "Everyday Checking", body: "Debit card, free ACME transfers. $12/mo fee waived with $1,500 balance." },
              { v: "savings" as const, icon: PiggyBank, title: "High-Yield Savings", body: "4.25% APY, no monthly fee. Interest paid monthly." },
            ].map((o) => (
              <button
                type="button"
                key={o.v}
                onClick={() => setType(o.v)}
                className={cn("rounded-xl border p-4 text-left transition", type === o.v ? "border-brand bg-accent/50 ring-1 ring-brand" : "hover:bg-muted/50")}
              >
                <o.icon className="mb-2 size-5 text-brand" />
                <p className="font-medium">{o.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{o.body}</p>
              </button>
            ))}
          </div>
          <Field label="Opening deposit (optional)" name="initial_deposit" error={fe?.initial_deposit} hint="Simulated transfer from your current bank. Free. Up to $25,000; $10,000+ triggers a manual review.">
            <MoneyInput name="initial_deposit" defaultValue="100.00" error={fe?.initial_deposit} />
          </Field>
          <div className="space-y-1">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox name="consent" value="on" className="mt-0.5" />
              <span className="text-muted-foreground">
                I confirm the information is accurate and I agree to the Deposit Account Agreement, Fee Schedule and Privacy Notice.
              </span>
            </label>
            <FieldError message={fe?.consent} />
          </div>
        </div>
      </div>

      {state && !state.ok && !fe && <FormMessage state={state} />}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue <ArrowRight />
          </Button>
        ) : (
          <SubmitButton size="lg" pendingLabel="Verifying…" className="bg-brand text-brand-foreground hover:bg-brand/90">
            Submit application
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

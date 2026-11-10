"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FormMessage, SubmitButton } from "@/components/common/forms";
import { forgotPasswordAction, resetPasswordAction, signInAction, signUpAction } from "@/actions/auth";
import type { ActionResult } from "@/lib/action-result";

function PasswordInput({ name, error, autoComplete, label = "Password", extra }: { name: string; error?: string; autoComplete: string; label?: string; extra?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={`f-${name}`}>{label}</Label>
        {extra}
      </div>
      <div className="relative">
        <Input
          id={`f-${name}`}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error) || undefined}
          className="pr-10"
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(signInAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {state && !state.ok && !fe && <FormMessage state={state} />}
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fe?.email} />
      <PasswordInput
        name="password"
        autoComplete="current-password"
        error={fe?.password}
        extra={
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline dark:text-brand">
            Forgot password?
          </Link>
        }
      />
      <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(signUpAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  if (state?.ok) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <MailCheck className="mx-auto mb-3 size-8 text-brand" />
        <p className="font-medium">Confirm your email</p>
        <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !fe && <FormMessage state={state} />}
      <Field label="Full name" name="full_name" autoComplete="name" required error={fe?.full_name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fe?.email} />
      <PasswordInput name="password" autoComplete="new-password" error={fe?.password} />
      <PasswordInput name="confirm" label="Confirm password" autoComplete="new-password" error={fe?.confirm} />
      <p className="text-xs text-muted-foreground">At least 8 characters, including a letter and a number.</p>
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox name="terms" value="on" className="mt-0.5" />
          <span className="text-muted-foreground">
            I agree to the ACME Bank Terms of Service, Privacy Notice and E-Sign Disclosure.
          </span>
        </label>
        <FieldError message={fe?.terms} />
      </div>
      <SubmitButton className="w-full" size="lg" pendingLabel="Creating profile…">
        Create profile
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(forgotPasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state && !fe ? state : null} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={fe?.email} />
      <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(resetPasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok && !fe && <FormMessage state={state} />}
      <PasswordInput name="password" label="New password" autoComplete="new-password" error={fe?.password} />
      <PasswordInput name="confirm" label="Confirm new password" autoComplete="new-password" error={fe?.confirm} />
      <SubmitButton className="w-full" size="lg" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}

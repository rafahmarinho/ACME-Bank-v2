"use client";

import { useActionState, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Field, FormMessage, FormSwitch, MoneyInput, NativeSelect, SubmitButton, useActionToast } from "@/components/common/forms";
import { changePasswordAction, updatePreferencesAction, updateProfileAction } from "@/actions/account";
import { centsToInput, initials } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { Preferences, Profile } from "@/lib/types";

export function ProfileForm({ profile, avatar }: { profile: Profile; avatar: string | null }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateProfileAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const [preview, setPreview] = useState<string | null>(avatar);
  useActionToast(state);
  return (
    <form action={action} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {preview && <AvatarImage src={preview} alt="" />}
          <AvatarFallback className="bg-primary text-lg text-primary-foreground">{initials(profile.full_name)}</AvatarFallback>
        </Avatar>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <Camera className="size-4" /> Change photo
          <input
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">PNG, JPG or WebP · max 2 MB</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="full_name" defaultValue={profile.full_name} error={fe?.full_name} />
        <Field label="Email" name="email_display" defaultValue={profile.email} disabled hint="Contact support to change your email." />
        <Field label="Phone" name="phone" defaultValue={profile.phone ?? ""} error={fe?.phone} autoComplete="tel" />
        <Field label="Street address" name="address_line1" defaultValue={profile.address_line1 ?? ""} error={fe?.address_line1} autoComplete="address-line1" />
        <Field label="City" name="city" defaultValue={profile.city ?? ""} error={fe?.city} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="State" name="state" defaultValue={profile.state ?? ""} maxLength={2} error={fe?.state} />
          <Field label="ZIP code" name="postal_code" defaultValue={profile.postal_code ?? ""} error={fe?.postal_code} />
        </div>
      </div>
      {state && !state.ok && !fe && <FormMessage state={state} />}
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}

export function PreferencesForm({ prefs }: { prefs: Preferences }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updatePreferencesAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state);
  return (
    <form action={action} className="space-y-5">
      <div className="divide-y rounded-lg border px-4">
        <FormSwitch name="push_alerts" label="In-app alerts" description="Real-time notifications for deposits, payments and declines" defaultChecked={prefs.push_alerts} />
        <FormSwitch name="email_alerts" label="Email alerts" description="Security and transaction emails (simulated)" defaultChecked={prefs.email_alerts} />
        <FormSwitch name="marketing_emails" label="Product news" description="Occasional updates about new ACME features" defaultChecked={prefs.marketing_emails} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Low balance alert below" name="low_balance_alert" error={fe?.low_balance_alert}>
          <MoneyInput name="low_balance_alert" defaultValue={centsToInput(prefs.low_balance_alert_cents)} error={fe?.low_balance_alert} />
        </Field>
        <Field label="Large purchase alert above" name="large_transaction_alert" error={fe?.large_transaction_alert}>
          <MoneyInput name="large_transaction_alert" defaultValue={centsToInput(prefs.large_transaction_alert_cents)} error={fe?.large_transaction_alert} />
        </Field>
        <Field label="Appearance" name="theme">
          <NativeSelect name="theme" id="f-theme" defaultValue={prefs.theme}>
            <option value="system">Match my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </NativeSelect>
        </Field>
      </div>
      {state && !state.ok && !fe && <FormMessage state={state} />}
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult | null, FormData>(changePasswordAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" error={fe?.current} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" name="password" type="password" autoComplete="new-password" error={fe?.password} hint="8+ characters with a number" />
        <Field label="Confirm new password" name="confirm" type="password" autoComplete="new-password" error={fe?.confirm} />
      </div>
      {state && !state.ok && !fe && <FormMessage state={state} />}
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}

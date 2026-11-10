"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, MoneyInput, NativeSelect, SubmitButton, useActionToast, FormMessage } from "@/components/common/forms";
import { openAdditionalAccountAction, simulateDepositAction, updateTransferLimitAction } from "@/actions/banking";
import type { ActionResult } from "@/lib/action-result";
import { centsToInput } from "@/lib/format";

export function OpenAccountDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState<ActionResult<string> | null, FormData>(openAdditionalAccountAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => {
    setOpen(false);
    if (state?.ok && state.data) router.push(`/accounts/${state.data}`);
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Open new account
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a new account</DialogTitle>
            <DialogDescription>Your identity is already verified, so the account opens instantly. No monthly fee on savings.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <Field label="Account type" name="type">
              <NativeSelect name="type" id="f-type" defaultValue="savings">
                <option value="savings">High-Yield Savings · 4.25% APY</option>
                <option value="checking">Everyday Checking · debit card included</option>
              </NativeSelect>
            </Field>
            <Field label="Nickname" name="nickname" defaultValue="Vacation fund" error={fe?.nickname} maxLength={40} />
            <Field label="Opening deposit (optional)" name="initial_deposit" error={fe?.initial_deposit} hint="Simulated transfer from an external bank, up to $25,000.">
              <MoneyInput name="initial_deposit" error={fe?.initial_deposit} />
            </Field>
            {state && !state.ok && !fe && <FormMessage state={state} />}
            <DialogFooter>
              <SubmitButton pendingLabel="Opening…">
                <PiggyBank /> Open account
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TransferLimitForm({ accountId, limitCents }: { accountId: string; limitCents: number }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateTransferLimitAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="account_id" value={accountId} />
      <Field label="Daily transfer limit" name="limit" error={fe?.limit} hint="Between $100 and $25,000. Applies to transfers and bill payments to other people.">
        <MoneyInput name="limit" defaultValue={centsToInput(limitCents)} error={fe?.limit} />
      </Field>
      <SubmitButton>Save limit</SubmitButton>
    </form>
  );
}

export function DepositForm({ accountId }: { accountId: string }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(simulateDepositAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="account_id" value={accountId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount" name="amount" error={fe?.amount}>
          <MoneyInput name="amount" error={fe?.amount} />
        </Field>
        <Field label="Method" name="method">
          <NativeSelect name="method" id="f-method" defaultValue="cash">
            <option value="cash">Cash at ATM · instant</option>
            <option value="wire">Incoming wire · instant</option>
            <option value="ach">ACH from another bank · 1 day</option>
            <option value="check">Mobile check · 2 days</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Description (optional)" name="description" placeholder="e.g. Birthday gift from Grandma" maxLength={120} />
      <SubmitButton pendingLabel="Depositing…">Simulate deposit</SubmitButton>
    </form>
  );
}

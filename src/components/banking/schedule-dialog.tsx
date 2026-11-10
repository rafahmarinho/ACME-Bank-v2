"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormMessage, MoneyInput, NativeSelect, SubmitButton, useActionToast } from "@/components/common/forms";
import { DefinitionList } from "@/components/common/display";
import { createScheduleAction } from "@/actions/banking";
import { formatCents, parseMoneyToCents } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";

type Opt = { id: string; label: string };

export function ScheduleDialog({ accounts, beneficiaries, today }: { accounts: Opt[]; beneficiaries: Opt[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState("monthly");
  const [state, action] = useActionState<ActionResult | null, FormData>(createScheduleAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => setOpen(false));
  const cents = parseMoneyToCents(amount);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus /> Schedule a payment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a payment</DialogTitle>
            <DialogDescription>Payments run automatically on the scheduled date (simulation clock).</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="today" value={today} />
            <Field label="Pay from" name="from" error={fe?.from}>
              <NativeSelect name="from" id="f-from" error={fe?.from}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Pay to" name="destination" error={fe?.destination}>
              <NativeSelect name="destination" id="f-destination" error={fe?.destination} defaultValue="">
                <option value="" disabled>
                  Choose a recipient
                </option>
                <optgroup label="Beneficiaries">
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={`beneficiary:${b.id}`}>
                      {b.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="My accounts">
                  {accounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>
                      {a.label}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
            </Field>
            <Field label="Description" name="description" placeholder="e.g. Internet bill" error={fe?.description} maxLength={120} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount" name="amount" error={fe?.amount}>
                <MoneyInput name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} error={fe?.amount} />
              </Field>
              <Field label="Frequency" name="frequency">
                <NativeSelect name="frequency" id="f-frequency" value={freq} onChange={(e) => setFreq(e.target.value)}>
                  <option value="once">One time</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </NativeSelect>
              </Field>
              <Field label={freq === "once" ? "Payment date" : "First payment"} name="next_run_date" type="date" min={today} defaultValue={today} error={fe?.next_run_date} />
              {freq !== "once" && <Field label="End date (optional)" name="end_date" type="date" min={today} error={fe?.end_date} />}
            </div>
            <div className="rounded-lg bg-muted/50 px-4">
              <DefinitionList
                items={[
                  ["Payment amount", cents ? formatCents(cents) : "—"],
                  ["Fee per payment", <span key="f" className="text-success">Free</span>],
                  ["Total per payment", cents ? formatCents(cents) : "—"],
                ]}
              />
            </div>
            {state && !state.ok && !fe && <FormMessage state={state} />}
            <DialogFooter>
              <SubmitButton pendingLabel="Scheduling…">Confirm schedule</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

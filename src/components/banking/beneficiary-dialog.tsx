"use client";

import { useActionState, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormMessage, FormSwitch, SubmitButton, useActionToast } from "@/components/common/forms";
import { saveBeneficiaryAction } from "@/actions/banking";
import type { ActionResult } from "@/lib/action-result";
import type { Beneficiary } from "@/lib/types";

export function BeneficiaryDialog({ beneficiary }: { beneficiary?: Beneficiary }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(saveBeneficiaryAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => setOpen(false));
  const editing = Boolean(beneficiary);

  return (
    <>
      {editing ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Edit ${beneficiary!.name}`}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus /> Add beneficiary
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit beneficiary" : "Add a beneficiary"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Account and routing numbers can't be changed. Remove and re-add the beneficiary instead."
                : "We'll recognize ACME Bank accounts automatically so transfers to them are instant and free (routing 021999001)."}
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            {editing && <input type="hidden" name="id" value={beneficiary!.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name or business" name="name" defaultValue={beneficiary?.name} error={fe?.name} required />
              <Field label="Nickname (optional)" name="nickname" defaultValue={beneficiary?.nickname ?? ""} error={fe?.nickname} />
            </div>
            <Field label="Bank name" name="bank_name" defaultValue={beneficiary?.bank_name ?? ""} error={fe?.bank_name} placeholder="e.g. Lakeshore National Bank" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Account number"
                name="account_number"
                inputMode="numeric"
                defaultValue={beneficiary?.account_number}
                disabled={editing}
                error={fe?.account_number}
              />
              <Field
                label="Routing number"
                name="routing_number"
                inputMode="numeric"
                maxLength={9}
                defaultValue={beneficiary?.routing_number}
                disabled={editing}
                error={fe?.routing_number}
              />
            </div>
            <Field label="Email for payment notices (optional)" name="email" type="email" defaultValue={beneficiary?.email ?? ""} error={fe?.email} />
            <FormSwitch name="is_favorite" label="Favorite" description="Show this beneficiary first in lists." defaultChecked={beneficiary?.is_favorite} />
            {state && !state.ok && !fe && <FormMessage state={state} />}
            <DialogFooter>
              <SubmitButton>{editing ? "Save changes" : "Add beneficiary"}</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

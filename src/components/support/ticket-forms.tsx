"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FormMessage, FormSwitch, NativeSelect, SubmitButton, useActionToast } from "@/components/common/forms";
import { createTicketAction, replyTicketAction } from "@/actions/account";
import type { ActionResult } from "@/lib/action-result";

const CATEGORIES = [
  { value: "general", label: "General question" },
  { value: "card", label: "Cards" },
  { value: "transfer", label: "Transfers & payments" },
  { value: "account", label: "Account & limits" },
  { value: "fraud", label: "Fraud or dispute" },
  { value: "statement", label: "Statements" },
  { value: "technical", label: "App or sign-in problem" },
];

function AttachmentInput() {
  const [name, setName] = useState<string | null>(null);
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
      <Paperclip className="size-4" />
      <span className="truncate">{name ?? "Attach a file (PNG, JPG, PDF, TXT · max 5 MB)"}</span>
      <input
        type="file"
        name="attachment"
        accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
        className="sr-only"
        onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}

export function NewTicketDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState<ActionResult<string> | null, FormData>(createTicketAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => {
    setOpen(false);
    if (state?.ok && state.data) router.push(`/support/${state.data}`);
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MessageSquarePlus /> New request
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact support</DialogTitle>
            <DialogDescription>Our team usually replies within one business day. For a lost card, lock it first from the Cards page.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <Field label="Topic" name="category">
              <NativeSelect name="category" id="f-category" defaultValue="general">
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Subject" name="subject" error={fe?.subject} maxLength={160} />
            <div className="space-y-1.5">
              <label htmlFor="f-body" className="text-sm font-medium">
                How can we help?
              </label>
              <Textarea id="f-body" name="body" rows={5} aria-invalid={Boolean(fe?.body) || undefined} />
              <FieldError message={fe?.body} />
            </div>
            <AttachmentInput />
            {state && !state.ok && !fe && <FormMessage state={state} />}
            <DialogFooter>
              <SubmitButton pendingLabel="Sending…">Send request</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReplyForm({ ticketId, staff = false, closed = false }: { ticketId: string; staff?: boolean; closed?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult | null, FormData>(replyTicketAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => formRef.current?.reset());
  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-xl border bg-card p-4">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <Textarea
        name="body"
        rows={3}
        placeholder={closed ? "Replying will reopen this conversation…" : "Write a reply…"}
        aria-invalid={Boolean(fe?.body) || undefined}
      />
      <FieldError message={fe?.body} />
      {staff && (
        <div className="rounded-lg border px-3">
          <FormSwitch name="internal" label="Internal note" description="Visible to ACME staff only" />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AttachmentInput />
        <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
      </div>
      {state && !state.ok && !fe && <FormMessage state={state} />}
    </form>
  );
}

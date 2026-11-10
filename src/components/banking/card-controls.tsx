"use client";

import { useActionState, useState } from "react";
import { ShoppingBag, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormMessage, FormSwitch, MoneyInput, NativeSelect, SubmitButton, useActionToast } from "@/components/common/forms";
import { simulatePurchaseAction, updateCardSettingsAction } from "@/actions/banking";
import { centsToInput } from "@/lib/format";
import type { ActionResult } from "@/lib/action-result";
import type { Card } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CardVisual({ card, className }: { card: Pick<Card, "last4" | "cardholder_name" | "expiry_month" | "expiry_year" | "status" | "brand">; className?: string }) {
  const inactive = card.status !== "active";
  return (
    <div
      className={cn(
        "relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl p-5 text-white shadow-lg ring-1 ring-white/10",
        "bg-gradient-to-br from-[var(--navy-800)] via-[var(--navy-900)] to-[var(--navy-950)]",
        inactive && "grayscale-[0.7]",
        className,
      )}
    >
      <div aria-hidden className="absolute -right-10 -bottom-16 size-48 rounded-full bg-[var(--orange-500)] opacity-30 blur-2xl" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            ACME <span className="text-[var(--orange-500)]">Debit</span>
          </span>
          <span className="text-lg font-bold italic">{card.brand.toUpperCase()}</span>
        </div>
        <div className="mt-5 h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
        <p className="mt-auto font-mono text-lg tracking-[0.18em]">•••• •••• •••• {card.last4}</p>
        <div className="mt-2 flex justify-between text-[11px] text-white/70">
          <span className="truncate">{card.cardholder_name}</span>
          <span>
            {String(card.expiry_month).padStart(2, "0")}/{String(card.expiry_year).slice(-2)}
          </span>
        </div>
      </div>
      {inactive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-sm font-semibold tracking-wider uppercase">
          {card.status}
        </div>
      )}
    </div>
  );
}

export function CardSettingsDialog({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(updateCardSettingsAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => setOpen(false));
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={card.status === "cancelled"}>
        <SlidersHorizontal /> Limits & controls
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Card ••{card.last4} limits & controls</DialogTitle>
            <DialogDescription>Changes take effect immediately for new purchases.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <input type="hidden" name="card_id" value={card.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Daily spending limit" name="daily_limit" error={fe?.daily_limit} hint="Up to $10,000">
                <MoneyInput name="daily_limit" defaultValue={centsToInput(card.daily_limit_cents)} error={fe?.daily_limit} />
              </Field>
              <Field label="Monthly spending limit" name="monthly_limit" error={fe?.monthly_limit} hint="Up to $50,000">
                <MoneyInput name="monthly_limit" defaultValue={centsToInput(card.monthly_limit_cents)} error={fe?.monthly_limit} />
              </Field>
            </div>
            <div className="divide-y rounded-lg border px-4">
              <FormSwitch name="online" label="Online purchases" description="Websites and in-app payments" defaultChecked={card.online_enabled} />
              <FormSwitch name="contactless" label="Contactless payments" description="Tap to pay in stores" defaultChecked={card.contactless_enabled} />
              <FormSwitch name="international" label="International purchases" description="A 3% foreign transaction fee applies" defaultChecked={card.international_enabled} />
            </div>
            {state && !state.ok && !fe && <FormMessage state={state} />}
            <DialogFooter>
              <SubmitButton>Save</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const CATEGORIES = ["Groceries", "Dining", "Shopping", "Transport", "Entertainment", "Health", "Travel"];

export function SimulatePurchaseDialog({ cards }: { cards: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult | null, FormData>(simulatePurchaseAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  useActionToast(state, () => setOpen(false));
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={cards.length === 0}>
        <ShoppingBag /> Simulate a purchase
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulate a card purchase</DialogTitle>
            <DialogDescription>Runs a real authorization against your card status, limits and available balance.</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <Field label="Card" name="card_id">
              <NativeSelect name="card_id" id="f-card_id">
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Merchant" name="merchant" defaultValue="Northwind Outfitters" error={fe?.merchant} />
              <Field label="Amount" name="amount" error={fe?.amount}>
                <MoneyInput name="amount" defaultValue="49.99" error={fe?.amount} />
              </Field>
              <Field label="Category" name="category">
                <NativeSelect name="category" id="f-category" defaultValue="Shopping">
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Channel" name="channel">
                <NativeSelect name="channel" id="f-channel" defaultValue="in_store">
                  <option value="in_store">In store (chip)</option>
                  <option value="contactless">Contactless</option>
                  <option value="online">Online</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="rounded-lg border px-4">
              <FormSwitch name="international" label="International merchant" description="Adds a 3% foreign transaction fee" />
            </div>
            {state && !state.ok && !fe && <FormMessage state={state} />}
            <DialogFooter>
              <SubmitButton pendingLabel="Authorizing…">Authorize purchase</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

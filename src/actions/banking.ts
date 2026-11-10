"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/services/session";
import { cancelTransfer, createTransfer, quoteTransfer } from "@/services/transfers";
import { createBeneficiary, deleteBeneficiary, updateBeneficiary } from "@/services/beneficiaries";
import { createScheduledPayment, runScheduleNow, setScheduleStatus } from "@/services/payments";
import { replaceCard, setCardLocked, simulatePurchase, updateCardSettings } from "@/services/cards";
import { parseMoneyToCents, formatCents } from "@/lib/format";
import { type ActionResult, fail, zodFieldErrors } from "@/lib/action-result";
import type { TransferQuote, TransferResult } from "@/lib/types";

const money = (label = "Amount") =>
  z
    .string()
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v);
      if (cents == null || cents <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be a positive number like 125.50` });
        return z.NEVER;
      }
      return cents;
    });

const uuid = z.uuid("Choose an option");

function revalidateBanking() {
  for (const p of ["/dashboard", "/accounts", "/transfers", "/payments", "/cards", "/beneficiaries", "/statements", "/staff"]) {
    revalidatePath(p, "layout");
  }
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------
const TransferSchema = z
  .object({
    from: uuid,
    destination: z.string().min(1, "Choose who you're paying"),
    amount: money(),
    rail: z.enum(["internal", "ach", "instant", "wire"]).default("ach"),
    memo: z.string().trim().max(140).optional(),
    idempotency_key: z.string().max(80).optional(),
  })
  .transform((d) => {
    const [type, id] = d.destination.split(":");
    return {
      ...d,
      toAccountId: type === "account" ? id : null,
      beneficiaryId: type === "beneficiary" ? id : null,
    };
  });

export async function quoteTransferAction(input: {
  from: string;
  destination: string;
  amount: string;
  rail: string;
}): Promise<ActionResult<TransferQuote>> {
  const parsed = TransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase } = await requireSession();
    const d = parsed.data;
    const quote = await quoteTransfer(supabase, {
      fromAccountId: d.from,
      amountCents: d.amount,
      rail: d.rail,
      toAccountId: d.toAccountId,
      beneficiaryId: d.beneficiaryId,
    });
    return { ok: true, data: quote };
  } catch (e) {
    return fail(e);
  }
}

export async function createTransferAction(input: {
  from: string;
  destination: string;
  amount: string;
  rail: string;
  memo?: string;
  idempotency_key: string;
}): Promise<ActionResult<TransferResult>> {
  const parsed = TransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase } = await requireSession();
    const d = parsed.data;
    const result = await createTransfer(supabase, {
      fromAccountId: d.from,
      amountCents: d.amount,
      rail: d.rail,
      toAccountId: d.toAccountId,
      beneficiaryId: d.beneficiaryId,
      memo: d.memo,
      idempotencyKey: d.idempotency_key,
    });
    revalidateBanking();
    if (result.status === "failed") return { ok: false, error: `Transfer declined: ${result.failure_reason ?? "unknown reason"}.` };
    return { ok: true, data: result };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelTransferAction(txnId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await cancelTransfer(supabase, txnId);
    revalidateBanking();
    return { ok: true, message: "Transfer cancelled and funds released." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Beneficiaries
// ---------------------------------------------------------------------------
const BeneficiarySchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(120),
  nickname: z.string().trim().max(60).optional(),
  bank_name: z.string().trim().min(2, "Enter the bank name").max(80),
  account_number: z.string().trim().regex(/^\d{6,17}$/, "Account numbers have 6–17 digits"),
  routing_number: z.string().trim().regex(/^\d{9}$/, "Routing numbers have 9 digits"),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  is_favorite: z.string().optional(),
});

export async function saveBeneficiaryAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const id = formData.get("id")?.toString();
  const raw = Object.fromEntries(formData);
  const parsed = (id ? BeneficiarySchema.partial({ account_number: true, routing_number: true }) : BeneficiarySchema).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase, userId } = await requireSession();
    const d = parsed.data;
    const input = {
      name: d.name,
      nickname: d.nickname || null,
      bankName: d.bank_name,
      accountNumber: d.account_number ?? "",
      routingNumber: d.routing_number ?? "",
      email: d.email || null,
      isFavorite: d.is_favorite === "on",
    };
    if (id) await updateBeneficiary(supabase, id, input);
    else await createBeneficiary(supabase, userId, input);
    revalidateBanking();
    return { ok: true, message: id ? "Beneficiary updated." : `${d.name} was added to your beneficiaries.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBeneficiaryAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await deleteBeneficiary(supabase, id);
    revalidateBanking();
    return { ok: true, message: "Beneficiary removed." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Scheduled payments
// ---------------------------------------------------------------------------
const ScheduleSchema = z
  .object({
    from: uuid,
    destination: z.string().min(1, "Choose who you're paying"),
    description: z.string().trim().min(3, "Add a short description").max(120),
    amount: money(),
    frequency: z.enum(["once", "weekly", "biweekly", "monthly"]),
    next_run_date: z.iso.date("Choose the first payment date"),
    end_date: z.union([z.literal(""), z.iso.date()]).optional(),
    today: z.iso.date(),
  })
  .refine((d) => d.next_run_date >= d.today, { path: ["next_run_date"], message: "The first payment can't be in the past" })
  .refine((d) => !d.end_date || d.end_date >= d.next_run_date, { path: ["end_date"], message: "End date must be after the first payment" });

export async function createScheduleAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = ScheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase, userId } = await requireSession();
    const d = parsed.data;
    const [type, id] = d.destination.split(":");
    await createScheduledPayment(supabase, userId, {
      fromAccountId: d.from,
      beneficiaryId: type === "beneficiary" ? id : null,
      toAccountId: type === "account" ? id : null,
      description: d.description,
      amountCents: d.amount,
      frequency: d.frequency,
      nextRunDate: d.next_run_date,
      endDate: d.end_date || null,
    });
    revalidateBanking();
    return { ok: true, message: `Scheduled ${formatCents(d.amount)} — ${d.description}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function setScheduleStatusAction(id: string, status: "active" | "paused" | "cancelled"): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await setScheduleStatus(supabase, id, status);
    revalidateBanking();
    return { ok: true, message: status === "active" ? "Payment resumed." : status === "paused" ? "Payment paused." : "Payment cancelled." };
  } catch (e) {
    return fail(e);
  }
}

export async function runScheduleNowAction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    const r = await runScheduleNow(supabase, id);
    revalidateBanking();
    if (r.last_result === "posted" || r.last_result === "pending") return { ok: true, message: `Payment ${r.last_result}.` };
    return { ok: false, error: `Payment failed: ${r.last_result}` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
export async function toggleCardLockAction(cardId: string, locked: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await setCardLocked(supabase, cardId, locked);
    revalidateBanking();
    return { ok: true, message: locked ? "Card locked. New purchases will be declined." : "Card unlocked." };
  } catch (e) {
    return fail(e);
  }
}

const CardSettingsSchema = z
  .object({
    card_id: uuid,
    daily_limit: money("Daily limit"),
    monthly_limit: money("Monthly limit"),
    online: z.string().optional(),
    contactless: z.string().optional(),
    international: z.string().optional(),
  })
  .refine((d) => d.daily_limit <= 1_000_000, { path: ["daily_limit"], message: "Daily limit can be at most $10,000" })
  .refine((d) => d.monthly_limit <= 5_000_000, { path: ["monthly_limit"], message: "Monthly limit can be at most $50,000" })
  .refine((d) => d.monthly_limit >= d.daily_limit, { path: ["monthly_limit"], message: "Monthly limit must be at least the daily limit" });

export async function updateCardSettingsAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = CardSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase } = await requireSession();
    const d = parsed.data;
    await updateCardSettings(supabase, d.card_id, {
      dailyLimitCents: d.daily_limit,
      monthlyLimitCents: d.monthly_limit,
      online: d.online === "on",
      contactless: d.contactless === "on",
      international: d.international === "on",
    });
    revalidateBanking();
    return { ok: true, message: "Card limits and controls saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function replaceCardAction(cardId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    const r = await replaceCard(supabase, cardId);
    revalidateBanking();
    return { ok: true, message: `Replacement card issued. A ${formatCents(r.fee_cents)} fee was charged.` };
  } catch (e) {
    return fail(e);
  }
}

const PurchaseSchema = z.object({
  card_id: uuid,
  amount: money(),
  merchant: z.string().trim().min(2, "Enter a merchant").max(80),
  category: z.string().min(1),
  channel: z.enum(["in_store", "online", "contactless"]),
  international: z.string().optional(),
});

export async function simulatePurchaseAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = PurchaseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase } = await requireSession();
    const d = parsed.data;
    const r = await simulatePurchase(supabase, {
      cardId: d.card_id,
      amountCents: d.amount,
      merchant: d.merchant,
      category: d.category,
      channel: d.channel,
      international: d.international === "on",
    });
    revalidateBanking();
    if (r.status === "failed") return { ok: false, error: `Declined: ${r.failure_reason}` };
    return {
      ok: true,
      message: `Approved: ${formatCents(d.amount)} at ${d.merchant}${r.fee_cents ? ` (+${formatCents(r.fee_cents)} foreign fee)` : ""}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
const LimitSchema = z.object({ account_id: uuid, limit: money("Limit") });

export async function updateTransferLimitAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = LimitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase } = await requireSession();
    const { error } = await supabase.rpc("update_transfer_limit", { p_account: parsed.data.account_id, p_limit: parsed.data.limit });
    if (error) throw error;
    revalidateBanking();
    return { ok: true, message: `Daily transfer limit set to ${formatCents(parsed.data.limit)}.` };
  } catch (e) {
    return fail(e);
  }
}

const DepositSchema = z.object({
  account_id: uuid,
  amount: money(),
  method: z.enum(["cash", "ach", "check", "wire"]),
  description: z.string().trim().max(120).optional(),
});

export async function simulateDepositAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = DepositSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase } = await requireSession();
    const d = parsed.data;
    const { data, error } = await supabase.rpc("simulate_deposit", {
      p_account: d.account_id,
      p_amount: d.amount,
      p_method: d.method,
      p_description: d.description,
    });
    if (error) throw error;
    revalidateBanking();
    const status = (data as { status: string }).status;
    return {
      ok: true,
      message:
        status === "posted"
          ? `${formatCents(d.amount)} deposited and available now.`
          : `${formatCents(d.amount)} deposit is pending. It will post when the simulation advances.`,
    };
  } catch (e) {
    return fail(e);
  }
}

const OpenAccountSchema = z.object({
  type: z.enum(["checking", "savings"]),
  nickname: z.string().trim().min(2, "Give the account a name").max(40),
  initial_deposit: z.string().optional(),
});

export async function openAdditionalAccountAction(_: ActionResult | null, formData: FormData): Promise<ActionResult<string>> {
  const parsed = OpenAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const deposit = parsed.data.initial_deposit ? parseMoneyToCents(parsed.data.initial_deposit) : 0;
  if (deposit == null) return { ok: false, error: "Enter a valid opening deposit", fieldErrors: { initial_deposit: "Enter a valid amount" } };
  try {
    const { supabase } = await requireSession();
    const { data, error } = await supabase.rpc("open_additional_account", {
      p_type: parsed.data.type,
      p_nickname: parsed.data.nickname,
      p_initial_deposit: deposit,
    });
    if (error) throw error;
    revalidateBanking();
    return { ok: true, message: `${parsed.data.nickname} is open and ready to use.`, data: data as string };
  } catch (e) {
    return fail(e);
  }
}

const ApplicationSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your legal name").max(120),
  date_of_birth: z.iso.date("Enter your date of birth"),
  phone: z.string().trim().regex(/^[\d\s()+-]{7,20}$/, "Enter a valid phone number"),
  address_line1: z.string().trim().min(3, "Enter your street address").max(120),
  city: z.string().trim().min(2, "Enter your city").max(60),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/, "Use the 2-letter state code"),
  postal_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  ssn_last4: z.string().trim().regex(/^\d{4}$/, "Enter exactly 4 digits"),
  employment_status: z.enum(["employed", "self_employed", "student", "retired", "unemployed"]),
  annual_income: z.string().optional(),
  account_type: z.enum(["checking", "savings"]),
  initial_deposit: z.string().optional(),
  consent: z.literal("on", { error: "Please confirm the disclosures" }),
});

export async function submitApplicationAction(_: ActionResult | null, formData: FormData): Promise<ActionResult<{ status: string }>> {
  const parsed = ApplicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const income = d.annual_income ? parseMoneyToCents(d.annual_income) : 0;
  const deposit = d.initial_deposit ? parseMoneyToCents(d.initial_deposit) : 0;
  if (income == null) return { ok: false, error: "Enter a valid income", fieldErrors: { annual_income: "Enter a valid amount" } };
  if (deposit == null || deposit > 2_500_000)
    return { ok: false, error: "Opening deposit must be up to $25,000", fieldErrors: { initial_deposit: "Up to $25,000" } };
  try {
    const { supabase } = await requireSession();
    const { data, error } = await supabase.rpc("submit_account_application", {
      p_full_name: d.full_name,
      p_date_of_birth: d.date_of_birth,
      p_phone: d.phone,
      p_address_line1: d.address_line1,
      p_city: d.city,
      p_state: d.state,
      p_postal_code: d.postal_code,
      p_ssn_last4: d.ssn_last4,
      p_employment_status: d.employment_status,
      p_annual_income: income,
      p_account_type: d.account_type,
      p_initial_deposit: deposit,
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, data: data as { status: string } };
  } catch (e) {
    return fail(e);
  }
}

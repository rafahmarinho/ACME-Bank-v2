"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/services/session";
import { preferencesOf, updateContactDetails, updatePreferences, uploadAvatar } from "@/services/profile";
import { markAllRead } from "@/services/notifications";
import { addMessage, createTicket, updateTicket } from "@/services/support";
import { parseMoneyToCents } from "@/lib/format";
import { type ActionResult, fail, zodFieldErrors } from "@/lib/action-result";

// ---------------------------------------------------------------------------
// Profile & settings
// ---------------------------------------------------------------------------
const ProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[\d\s()+-]{7,20}$/, "Enter a valid phone number")]),
  address_line1: z.string().trim().max(120),
  city: z.string().trim().max(60),
  state: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z]{2}$/, "Use the 2-letter state code")]),
  postal_code: z.union([z.literal(""), z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code")]),
});

export async function updateProfileAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase, userId } = await requireSession();
    const d = parsed.data;
    await updateContactDetails(supabase, userId, {
      full_name: d.full_name,
      phone: d.phone || null,
      address_line1: d.address_line1 || null,
      city: d.city || null,
      state: d.state ? d.state.toUpperCase() : null,
      postal_code: d.postal_code || null,
    });
    const avatar = formData.get("avatar");
    if (avatar instanceof File && avatar.size > 0) await uploadAvatar(supabase, userId, avatar);
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePreferencesAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, userId, profile } = await requireSession();
    const current = preferencesOf(profile);
    const low = parseMoneyToCents(String(formData.get("low_balance_alert") ?? ""));
    const large = parseMoneyToCents(String(formData.get("large_transaction_alert") ?? ""));
    if (low == null || large == null) {
      return {
        ok: false,
        error: "Check the highlighted fields",
        fieldErrors: {
          ...(low == null ? { low_balance_alert: "Enter an amount" } : {}),
          ...(large == null ? { large_transaction_alert: "Enter an amount" } : {}),
        },
      };
    }
    const theme = String(formData.get("theme") ?? current.theme);
    await updatePreferences(supabase, userId, {
      email_alerts: formData.get("email_alerts") === "on",
      push_alerts: formData.get("push_alerts") === "on",
      marketing_emails: formData.get("marketing_emails") === "on",
      low_balance_alert_cents: low,
      large_transaction_alert_cents: large,
      theme: (["light", "dark", "system"].includes(theme) ? theme : "system") as "light" | "dark" | "system",
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "Use at least 8 characters").regex(/\d/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((d) => d.password !== d.current, { path: ["password"], message: "Choose a new password" });

export async function changePasswordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = PasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase, profile } = await requireSession();
    const { error: authError } = await supabase.auth.signInWithPassword({ email: profile.email, password: parsed.data.current });
    if (authError) return { ok: false, error: "Your current password is incorrect", fieldErrors: { current: "Incorrect password" } };
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw error;
    return { ok: true, message: "Password updated." };
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await markAllRead(supabase);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------
const TicketSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject").max(160),
  category: z.enum(["general", "card", "transfer", "account", "fraud", "statement", "technical"]),
  body: z.string().trim().min(10, "Describe the issue in a few words (10+ characters)").max(5000),
});

export async function createTicketAction(_: ActionResult | null, formData: FormData): Promise<ActionResult<string>> {
  const parsed = TicketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase, userId } = await requireSession();
    const file = formData.get("attachment");
    const ticket = await createTicket(supabase, userId, { ...parsed.data, file: file instanceof File ? file : null });
    revalidatePath("/support", "layout");
    revalidatePath("/staff", "layout");
    return { ok: true, message: `Ticket #${ticket.number} created. We'll reply soon.`, data: ticket.id };
  } catch (e) {
    return fail(e);
  }
}

const ReplySchema = z.object({
  ticket_id: z.uuid(),
  body: z.string().trim().min(1, "Write a message").max(5000),
  internal: z.string().optional(),
});

export async function replyTicketAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = ReplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  try {
    const { supabase, userId } = await requireSession();
    const file = formData.get("attachment");
    await addMessage(supabase, userId, parsed.data.ticket_id, {
      body: parsed.data.body,
      internal: parsed.data.internal === "on",
      file: file instanceof File ? file : null,
    });
    revalidatePath("/support", "layout");
    revalidatePath("/staff", "layout");
    return { ok: true, message: parsed.data.internal === "on" ? "Internal note added." : "Message sent." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTicketAction(
  ticketId: string,
  patch: { status?: string; priority?: string; assigned_to?: string | null },
): Promise<ActionResult> {
  try {
    const { supabase } = await requireSession();
    await updateTicket(supabase, ticketId, patch as Parameters<typeof updateTicket>[2]);
    revalidatePath("/support", "layout");
    revalidatePath("/staff", "layout");
    return { ok: true, message: "Ticket updated." };
  } catch (e) {
    return fail(e);
  }
}

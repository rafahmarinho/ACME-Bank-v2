"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { type ActionResult, zodFieldErrors } from "@/lib/action-result";

const safeNext = (next: unknown) => {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/home";
};

const LoginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function signInAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      error: /invalid login credentials/i.test(error.message)
        ? "Incorrect email or password."
        : /email not confirmed/i.test(error.message)
          ? "Confirm your email address before signing in."
          : error.message,
    };
  }
  redirect(safeNext(formData.get("next")));
}

const SignupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirm: z.string(),
    terms: z.literal("on", { error: "You must accept the terms to continue" }),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function signUpAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/open-account`,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.session) {
    return { ok: true, message: "Check your inbox — we sent a confirmation link to finish creating your profile." };
  }
  redirect("/open-account");
}

export async function forgotPasswordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email address", fieldErrors: { email: "Enter a valid email address" } };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Always respond the same way so the form cannot be used to discover accounts.
  if (error && !/rate limit/i.test(error.message)) console.error("resetPasswordForEmail", error.message);
  if (error && /rate limit/i.test(error.message)) return { ok: false, error: "Too many requests. Please wait a minute and try again." };
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

const ResetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").regex(/\d/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function resetPasswordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = ResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      error: /session/i.test(error.message) ? "Your reset link has expired. Request a new one." : error.message,
    };
  }
  redirect("/home?password=updated");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

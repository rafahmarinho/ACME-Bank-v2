import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the email you use for ACME Bank and we&apos;ll send you a secure link to choose a new password.
        </p>
      </div>
      <ForgotPasswordForm />
      {process.env.NODE_ENV !== "production" && (
        <p className="text-xs text-muted-foreground">
          Local development: reset emails are delivered to Mailpit at{" "}
          <a className="underline" href="http://127.0.0.1:55424" target="_blank" rel="noreferrer">
            127.0.0.1:55424
          </a>
          .
        </p>
      )}
    </div>
  );
}

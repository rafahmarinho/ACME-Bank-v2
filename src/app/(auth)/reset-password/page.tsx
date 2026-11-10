import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">You&apos;re signed in through your reset link. Pick a strong password you don&apos;t use elsewhere.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}

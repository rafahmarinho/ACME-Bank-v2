import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Open an account" };

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-1 text-xs font-semibold tracking-wider text-brand uppercase">Step 1 of 2</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">Create your ACME profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Next, we&apos;ll verify your identity and open your first account. It takes about 3 minutes.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground">
        Already a customer?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline dark:text-brand">
          Sign in
        </Link>
      </p>
    </div>
  );
}

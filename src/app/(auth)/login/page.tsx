import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-forms";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { DEMO_USERS } from "@/lib/demo/users";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your accounts, cards and payments.</p>
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        New to ACME Bank?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline dark:text-brand">
          Open an account
        </Link>
      </p>
      <DemoAccounts
        password={process.env.DEMO_PASSWORD ?? "AcmeDemo!2026"}
        users={DEMO_USERS.map((u) => ({ email: u.email, name: u.fullName, role: u.role, title: u.title }))}
      />
    </div>
  );
}

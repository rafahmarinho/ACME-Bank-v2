import Link from "next/link";
import { ShieldCheck, Zap, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-[520px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--orange-500), transparent 65%)" }}
        />
        <Link href="/" className="relative">
          <Logo tone="light" />
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold text-white">Banking that keeps up with your life.</h2>
          <p className="mt-3 text-sidebar-foreground/75">
            Open an account in minutes, move money instantly and stay in control of every card.
          </p>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              { icon: Zap, t: "Instant transfers between ACME accounts — always free" },
              { icon: ShieldCheck, t: "Lock your card or change limits in one tap" },
              { icon: Wallet, t: "Transparent fees shown before you confirm" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="rounded-lg bg-sidebar-accent p-2">
                  <Icon className="size-4 text-brand" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-sidebar-foreground/50">
          ACME Bank is a simulated bank for demonstration purposes. No real money is moved.
        </p>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  );
}

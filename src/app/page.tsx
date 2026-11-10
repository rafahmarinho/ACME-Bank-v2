import Link from "next/link";
import { ArrowRight, CalendarClock, CreditCard, FileText, Lock, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/format";

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data: fees }, { data: claims }] = await Promise.all([
    supabase.from("fee_schedule").select("*").order("flat_cents"),
    supabase.auth.getClaims(),
  ]);
  const signedIn = Boolean(claims?.claims?.sub);

  const features = [
    { icon: Send, title: "Instant transfers", body: "Move money between ACME accounts in seconds, free. ACH, instant and wire options for other banks." },
    { icon: CreditCard, title: "Card controls", body: "Lock a card, toggle online or international use and set daily and monthly limits in one tap." },
    { icon: CalendarClock, title: "Scheduled payments", body: "Automate rent, bills and savings — weekly, every two weeks or monthly." },
    { icon: FileText, title: "Statements on demand", body: "Download a statement for any date range as PDF or CSV, ready for your accountant." },
    { icon: ShieldCheck, title: "Fraud monitoring", body: "Real-time alerts and automatic card locks when something looks off." },
    { icon: Lock, title: "Transparent fees", body: "Every fee is shown before you confirm. No surprises, ever." },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="bg-sidebar">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo tone="light" />
          <nav className="flex items-center gap-2">
            {signedIn ? (
              <Link href="/home" className={buttonVariants({ className: "bg-brand text-brand-foreground hover:bg-brand/90" })}>
                Go to my accounts <ArrowRight />
              </Link>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "text-white hover:bg-white/10 hover:text-white")}>
                  Sign in
                </Link>
                <Link href="/signup" className={buttonVariants({ className: "bg-brand text-brand-foreground hover:bg-brand/90" })}>
                  Open an account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-sidebar pb-24 text-sidebar-foreground">
        <div
          aria-hidden
          className="absolute top-10 -right-40 size-[620px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--orange-500), transparent 65%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sidebar-accent px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3.5 text-brand" /> 4.25% APY on High-Yield Savings
            </span>
            <h1 className="mt-5 text-4xl leading-[1.1] font-semibold tracking-tight text-white sm:text-5xl">
              Everyday banking, <span className="text-brand">without the friction.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-sidebar-foreground/75">
              Checking and savings accounts, instant transfers, smart cards and real-time alerts — all from one secure app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg", className: "h-11 bg-brand px-5 text-brand-foreground hover:bg-brand/90" })}>
                Open an account in minutes <ArrowRight />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 border-white/20 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white")}>
                Explore the demo
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="rotate-[-4deg] rounded-2xl bg-gradient-to-br from-[var(--navy-800)] to-[var(--navy-950)] p-6 shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center justify-between text-white/80">
                <span className="text-sm font-medium">ACME Debit</span>
                <span className="text-sm font-semibold italic">VISA</span>
              </div>
              <div className="mt-10 font-mono text-xl tracking-[0.2em] text-white">•••• •••• •••• 4821</div>
              <div className="mt-6 flex justify-between text-xs text-white/60">
                <span>OLIVIA BENNETT</span>
                <span>09/30</span>
              </div>
            </div>
            <div className="absolute -bottom-10 -left-4 w-64 rounded-xl bg-card p-4 text-card-foreground shadow-xl ring-1 ring-black/5 sm:-left-10">
              <p className="text-xs text-muted-foreground">Available balance</p>
              <p className="mt-1 text-2xl font-semibold tabular text-primary dark:text-white">$5,423.73</p>
              <p className="mt-2 text-xs text-success">+ $3,850.00 payroll received</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-primary dark:text-white">Everything you need, nothing you don&apos;t</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6">
              <span className="inline-flex rounded-lg bg-accent p-2.5 text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">Fee schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">Clear pricing, shown again before every confirmation.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(fees ?? []).map((f) => (
              <div key={f.code} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{f.name}</p>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular">
                  {f.percent_bps ? `${f.percent_bps / 100}%` : f.flat_cents ? formatCents(f.flat_cents) : "Free"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-sidebar py-10 text-sm text-sidebar-foreground/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo tone="light" />
          <p>ACME Bank is a simulated bank built for demonstration. No real deposits or payments.</p>
        </div>
      </footer>
    </div>
  );
}

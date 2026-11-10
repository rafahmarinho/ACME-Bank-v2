import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-1 text-2xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have moved, or you may not have access to it.</p>
      </div>
      <Link href="/home" className={buttonVariants()}>
        Back to ACME Bank
      </Link>
    </div>
  );
}

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill="var(--orange-500)" />
      <path d="M16 6.5 7.5 25h4.2l1.7-4h5.2l1.7 4h4.2L16 6.5Zm-1.3 11.2L16 14.4l1.3 3.3h-2.6Z" fill="var(--navy-950)" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className={cn("text-lg", tone === "light" ? "text-white" : "text-primary dark:text-white")}>
        ACME <span className="text-brand">Bank</span>
      </span>
    </span>
  );
}

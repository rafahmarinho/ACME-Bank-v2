"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  FlaskConical,
  Headset,
  Home,
  LayoutGrid,
  ListTree,
  type LucideIcon,
  MessagesSquare,
  PiggyBank,
  Settings,
  ShieldCheck,
  User,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { accountNav, type NavIcon, type NavItem, type NavSection } from "./nav-config";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  accounts: Wallet,
  transfers: ArrowLeftRight,
  beneficiaries: Users,
  payments: CalendarClock,
  cards: CreditCard,
  statements: FileText,
  support: Headset,
  staff: BarChart3,
  customers: Users,
  reviews: ClipboardCheck,
  tickets: MessagesSquare,
  events: ListTree,
  simulation: FlaskConical,
  users: ShieldCheck,
  profile: User,
  settings: Settings,
  open: UserPlus,
};

function isActive(pathname: string, href: string) {
  if (href === "/staff" || href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const Icon = ICONS[item.icon];
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-4.5", active ? "text-sidebar-primary" : "opacity-80")} />
      {item.label}
    </Link>
  );
}

function SectionList({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <div key={i} className="space-y-1">
          {s.title && (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">{s.title}</p>
          )}
          {s.items.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Sidebar({ sections, footer }: { sections: NavSection[]; footer?: React.ReactNode }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/home" aria-label="ACME Bank home">
          <Logo tone="light" />
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <SectionList sections={sections} />
        <div className="mt-6 space-y-1 border-t border-sidebar-border pt-6">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">You</p>
          {accountNav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>
      {footer && <div className="border-t border-sidebar-border p-4">{footer}</div>}
    </aside>
  );
}

export function BottomNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const all = sections.flatMap((s) => s.items);
  const primary = all.filter((i) => i.mobile).slice(0, 4);
  const moreActive = !primary.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav
        aria-label="Mobile"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                    active ? "text-primary dark:text-brand" : "text-muted-foreground",
                  )}
                >
                  <span className={cn("rounded-full px-3 py-1", active && "bg-accent")}>
                    <Icon className={cn("size-5", active && "text-brand")} />
                  </span>
                  {item.label.split(" ")[0]}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                moreActive ? "text-primary dark:text-brand" : "text-muted-foreground",
              )}
            >
              <span className={cn("rounded-full px-3 py-1", moreActive && "bg-accent")}>
                <LayoutGrid className={cn("size-5", moreActive && "text-brand")} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-sidebar text-sidebar-foreground">
          <SheetHeader>
            <SheetTitle className="text-white">
              <span className="inline-flex items-center gap-2">
                <PiggyBank className="size-5 text-brand" /> Menu
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <SectionList sections={[...sections, { title: "You", items: accountNav }]} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

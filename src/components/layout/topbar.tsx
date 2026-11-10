"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Bell, CheckCheck, Clock3, LogOut, Settings, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { formatDateTime, initials, titleCase } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { markNotificationsReadAction } from "@/actions/account";
import { signOutAction } from "@/actions/auth";

const KIND_DOT: Record<string, string> = {
  info: "bg-chart-3",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
};

export function NotificationsBell({ items, unread }: { items: Notification[]; unread: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4 font-bold text-brand-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          <button
            type="button"
            disabled={pending || unread === 0}
            onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary disabled:opacity-40 dark:text-brand"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>
        <ul className="max-h-[60vh] divide-y overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
          {items.map((n) => (
            <li key={n.id} className={cn("px-4 py-3", !n.read_at && "bg-accent/40")}>
              <Link href={n.link ?? "#"} className="flex gap-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[n.kind] ?? "bg-muted")} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block text-sm text-muted-foreground">{n.body}</span>
                  <span className="mt-1 block text-xs text-muted-foreground/80">{formatDateTime(n.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function UserMenu({
  name,
  email,
  role,
  avatar,
}: {
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-muted" aria-label="Account menu">
        <Avatar className="size-8">
          {avatar && <AvatarImage src={avatar} alt="" />}
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:block">{name.split(" ")[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block font-medium text-foreground">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
            <Badge variant="secondary" className="mt-1.5">{titleCase(role)}</Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOutAction()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SimClock({ now, scenario }: { now: string; scenario: string }) {
  return (
    <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground md:flex" title="Simulated bank clock">
      <Clock3 className="size-3.5 text-brand" />
      <span className="tabular">{formatDateTime(now)}</span>
      {scenario !== "baseline" && (
        <Badge variant="outline" className="border-brand/40 text-[10px]">
          {titleCase(scenario)}
        </Badge>
      )}
    </div>
  );
}

export function MobileBrand() {
  return (
    <Link href="/home" className="flex items-center gap-2 lg:hidden" aria-label="ACME Bank home">
      <LogoMark className="size-7" />
      <span className="font-semibold text-primary dark:text-white">ACME</span>
    </Link>
  );
}

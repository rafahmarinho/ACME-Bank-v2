"use client";

import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

type DemoUser = { email: string; name: string; role: string; title: string };

/** Demo helper: fills the sign-in form with one of the seeded users. */
export function DemoAccounts({ users, password }: { users: DemoUser[]; password: string }) {
  const [open, setOpen] = useState(false);
  const fill = (email: string) => {
    const form = document.querySelector("form");
    const e = form?.querySelector<HTMLInputElement>('input[name="email"]');
    const p = form?.querySelector<HTMLInputElement>('input[name="password"]');
    if (e && p) {
      e.value = email;
      p.value = password;
      e.focus();
    }
  };
  return (
    <div className="rounded-xl border border-dashed bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <FlaskConical className="size-4 text-brand" /> Demo accounts
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t px-2 py-2">
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            Click a profile to fill the form. Password: <code className="font-mono">{password}</code>
          </p>
          <ul className="grid gap-1">
            {users.map((u) => (
              <li key={u.email}>
                <button
                  type="button"
                  onClick={() => fill(u.email)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{u.title}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      u.role === "customer" ? "bg-secondary text-secondary-foreground" : "bg-brand/20 text-accent-foreground",
                    )}
                  >
                    {u.role}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

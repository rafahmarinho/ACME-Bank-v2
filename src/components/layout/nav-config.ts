import type { UserRole } from "@/lib/types";

export type NavIcon =
  | "home"
  | "accounts"
  | "transfers"
  | "beneficiaries"
  | "payments"
  | "cards"
  | "statements"
  | "support"
  | "staff"
  | "customers"
  | "reviews"
  | "tickets"
  | "events"
  | "simulation"
  | "users"
  | "profile"
  | "settings"
  | "open";

export type NavItem = { href: string; label: string; icon: NavIcon; mobile?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

export function navFor(role: UserRole, verified: boolean): NavSection[] {
  if (role === "customer") {
    if (!verified) {
      return [{ items: [{ href: "/open-account", label: "Open an account", icon: "open", mobile: true }] }];
    }
    return [
      {
        items: [
          { href: "/dashboard", label: "Overview", icon: "home", mobile: true },
          { href: "/accounts", label: "Accounts", icon: "accounts", mobile: true },
          { href: "/transfers", label: "Transfers", icon: "transfers", mobile: true },
          { href: "/beneficiaries", label: "Beneficiaries", icon: "beneficiaries" },
          { href: "/payments", label: "Scheduled payments", icon: "payments" },
          { href: "/cards", label: "Cards", icon: "cards", mobile: true },
          { href: "/statements", label: "Statements", icon: "statements" },
        ],
      },
      { title: "Help", items: [{ href: "/support", label: "Support", icon: "support" }] },
    ];
  }
  const sections: NavSection[] = [
    {
      title: "Operations",
      items: [
        { href: "/staff", label: "Staff overview", icon: "staff", mobile: true },
        { href: "/staff/customers", label: "Customers", icon: "customers", mobile: true },
        { href: "/staff/reviews", label: "Review queue", icon: "reviews", mobile: true },
        { href: "/staff/tickets", label: "Support tickets", icon: "tickets", mobile: true },
        { href: "/staff/events", label: "Event log", icon: "events" },
      ],
    },
  ];
  if (role === "admin") {
    sections.push({
      title: "Administration",
      items: [
        { href: "/staff/simulation", label: "Simulation lab", icon: "simulation" },
        { href: "/staff/users", label: "Users & roles", icon: "users" },
      ],
    });
  }
  return sections;
}

export const accountNav: NavItem[] = [
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

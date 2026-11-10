import type { SupabaseClient } from "@supabase/supabase-js";

export type DemoUser = {
  email: string;
  fullName: string;
  role: "customer" | "support" | "admin";
  persona?: "salaried" | "freelancer" | "student" | "affluent" | "business" | "newcomer";
  phone: string;
  address: { line1: string; city: string; state: string; postalCode: string };
  dateOfBirth: string;
  title: string;
};

export const DEMO_USERS: DemoUser[] = [
  {
    email: "olivia.bennett@acmebank.test",
    fullName: "Olivia Bennett",
    role: "customer",
    persona: "salaried",
    title: "Data analyst · salaried, checking + savings",
    phone: "(555) 010-0001",
    address: { line1: "214 Harbor Lane", city: "Boston", state: "MA", postalCode: "02110" },
    dateOfBirth: "1990-03-14",
  },
  {
    email: "marcus.reed@acmebank.test",
    fullName: "Marcus Reed",
    role: "customer",
    persona: "freelancer",
    title: "Freelance designer · irregular income",
    phone: "(555) 010-0002",
    address: { line1: "88 Pine Street", city: "Portland", state: "OR", postalCode: "97204" },
    dateOfBirth: "1987-09-02",
  },
  {
    email: "sofia.alvarez@acmebank.test",
    fullName: "Sofia Alvarez",
    role: "customer",
    persona: "student",
    title: "Student · low balance, declines",
    phone: "(555) 010-0003",
    address: { line1: "12 College Ave", city: "Austin", state: "TX", postalCode: "78705" },
    dateOfBirth: "2003-06-21",
  },
  {
    email: "james.carter@acmebank.test",
    fullName: "James Carter",
    role: "customer",
    persona: "affluent",
    title: "Premier client · large transfers & reviews",
    phone: "(555) 010-0004",
    address: { line1: "1 Riverside Drive", city: "New York", state: "NY", postalCode: "10024" },
    dateOfBirth: "1975-11-30",
  },
  {
    email: "priya.natarajan@acmebank.test",
    fullName: "Priya Natarajan",
    role: "customer",
    persona: "business",
    title: "Restaurant owner · suppliers & wires",
    phone: "(555) 010-0005",
    address: { line1: "455 Market Street", city: "San Francisco", state: "CA", postalCode: "94105" },
    dateOfBirth: "1984-01-09",
  },
  {
    email: "ethan.walker@acmebank.test",
    fullName: "Ethan Walker",
    role: "customer",
    persona: "newcomer",
    title: "New customer · opened 3 weeks ago",
    phone: "(555) 010-0006",
    address: { line1: "18 Maple Street", city: "Hartford", state: "CT", postalCode: "06103" },
    dateOfBirth: "1998-04-12",
  },
  {
    email: "support@acmebank.test",
    fullName: "Sam Rivera",
    role: "support",
    title: "Support agent",
    phone: "(555) 010-0100",
    address: { line1: "ACME Bank HQ", city: "Chicago", state: "IL", postalCode: "60601" },
    dateOfBirth: "1992-05-05",
  },
  {
    email: "admin@acmebank.test",
    fullName: "Alex Morgan",
    role: "admin",
    title: "Administrator · simulation lab",
    phone: "(555) 010-0101",
    address: { line1: "ACME Bank HQ", city: "Chicago", state: "IL", postalCode: "60601" },
    dateOfBirth: "1985-08-17",
  },
];

/**
 * Creates (or repairs) every demo user with the Auth admin API and syncs their profile.
 * Requires a client created with the secret (service role) key.
 */
export async function ensureDemoUsers(admin: SupabaseClient, password: string) {
  const existing = new Map<string, string>();
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    data.users.forEach((u) => u.email && existing.set(u.email.toLowerCase(), u.id));
    if (data.users.length < 200) break;
  }

  for (const user of DEMO_USERS) {
    let id = existing.get(user.email);
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      });
      if (error) throw new Error(`Could not create ${user.email}: ${error.message}`);
      id = data.user.id;
    } else {
      await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      persona: user.persona ?? null,
      is_demo: true,
      phone: user.phone,
      date_of_birth: user.dateOfBirth,
      address_line1: user.address.line1,
      city: user.address.city,
      state: user.address.state,
      postal_code: user.address.postalCode,
      kyc_status: user.role === "customer" ? "verified" : "not_started",
    });
    if (profileError) throw new Error(`Profile ${user.email}: ${profileError.message}`);
  }
}

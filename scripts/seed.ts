/**
 * Seeds the ACME Bank demo: creates 6 customers + support + admin users and
 * generates two months of transactions via the `sim_reset_demo` database function.
 *
 *   pnpm db:seed            (reads .env.local)
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USERS, ensureDemoUsers } from "../src/lib/demo/users";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const password = process.env.DEMO_PASSWORD ?? "AcmeDemo!2026";
  if (!url || !secret) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.example)");
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("› Creating demo users…");
  await ensureDemoUsers(admin, password);

  console.log("› Generating two months of demo activity…");
  const { data, error } = await admin.rpc("sim_reset_demo");
  if (error) throw error;
  console.log("✓ Demo data ready:", data);
  console.log("\nSign in with any of these accounts (password: %s):", password);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email}`);
}

main().catch((err) => {
  console.error("✗ Seed failed:", err.message ?? err);
  process.exit(1);
});

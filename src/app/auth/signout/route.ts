import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Clears a stale or unwanted session (e.g. the user was deleted by a demo reset). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const url = new URL("/login", request.url);
  const reason = request.nextUrl.searchParams.get("reason");
  if (reason === "expired") url.searchParams.set("error", "Your session has ended. Please sign in again.");
  return NextResponse.redirect(url);
}

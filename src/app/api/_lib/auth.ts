import "server-only";
import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/action-result";

/** Resolves the API caller (cookie session or Bearer token) or returns a 401 response. */
export async function apiAuth() {
  const supabase = await createApiClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    return { error: NextResponse.json({ error: "unauthorized", message: "Sign in or send a Bearer access token" }, { status: 401 }) } as const;
  }
  return { supabase, userId } as const;
}

export function apiError(error: unknown, status = 400) {
  return NextResponse.json({ error: "request_failed", message: friendlyError(error) }, { status });
}

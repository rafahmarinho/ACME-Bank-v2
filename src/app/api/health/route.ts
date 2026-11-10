import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const started = Date.now();
  const supabase = await createClient();
  const { error } = await supabase.from("fee_schedule").select("code", { head: true, count: "exact" });
  return NextResponse.json(
    { status: error ? "degraded" : "ok", database: error ? error.message : "reachable", latency_ms: Date.now() - started },
    { status: error ? 503 : 200 },
  );
}

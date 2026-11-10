export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Turns Postgres / Supabase errors into a customer-friendly sentence. */
export function friendlyError(error: unknown): string {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that.";
  if (/JWT expired|invalid jwt|Auth session missing/i.test(message)) return "Your session has expired. Please sign in again.";
  if (/duplicate key/i.test(message)) return "That record already exists.";
  if (/fetch failed|ECONNREFUSED|network/i.test(message)) return "We couldn't reach the bank servers. Try again in a moment.";
  return message || "Something went wrong. Please try again.";
}

export function fail(error: unknown, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error: friendlyError(error), fieldErrors };
}

/** Flattens zod issues into { field: message }. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

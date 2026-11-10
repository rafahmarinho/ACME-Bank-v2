import { redirect } from "next/navigation";
import { homeFor, requireSession } from "@/services/session";

/** Role-aware landing after sign-in. */
export default async function HomeRedirect() {
  const { profile } = await requireSession();
  redirect(homeFor(profile));
}

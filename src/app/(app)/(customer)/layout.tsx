import { requireCustomer } from "@/services/session";

/** Banking screens are for verified customers only (staff are sent to /staff). */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireCustomer();
  return children;
}

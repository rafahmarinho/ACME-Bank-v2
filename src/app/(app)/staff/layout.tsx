import { requireStaff } from "@/services/session";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return children;
}

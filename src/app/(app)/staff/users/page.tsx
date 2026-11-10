import type { Metadata } from "next";
import { requireAdmin } from "@/services/session";
import { listStaffUsers } from "@/services/staff";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatusBadge } from "@/components/common/display";
import { RoleSelect } from "@/components/staff/role-select";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Users & roles" };

export default async function UsersPage() {
  const { supabase, userId } = await requireAdmin();
  const users = await listStaffUsers(supabase);
  return (
    <div>
      <PageHeader
        title="Users & roles"
        description="Customers see banking screens; support sees customers, reviews and tickets; admins also control the simulation."
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="hidden md:table-cell">Identity</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead className="w-44">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <span className="block font-medium">{u.full_name}</span>
                  <span className="block text-xs text-muted-foreground">{u.email}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <StatusBadge status={u.kyc_status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(u.created_at)}</TableCell>
                <TableCell>
                  <RoleSelect userId={u.id} role={u.role} disabled={u.id === userId} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

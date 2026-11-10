"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NativeSelect } from "@/components/common/forms";
import { setUserRoleAction } from "@/actions/staff";
import type { UserRole } from "@/lib/types";

export function RoleSelect({ userId, role, disabled }: { userId: string; role: UserRole; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <NativeSelect
      aria-label="Role"
      defaultValue={role}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = e.target.value as UserRole;
        start(async () => {
          const r = await setUserRoleAction(userId, next);
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <option value="customer">Customer</option>
      <option value="support">Support</option>
      <option value="admin">Admin</option>
    </NativeSelect>
  );
}

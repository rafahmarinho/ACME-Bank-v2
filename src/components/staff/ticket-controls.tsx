"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/common/forms";
import { updateTicketAction } from "@/actions/account";

export function TicketControls({
  ticketId,
  status,
  priority,
  assignedTo,
  staff,
}: {
  ticketId: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  staff: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const update = (patch: Record<string, string | null>) =>
    start(async () => {
      const r = await updateTicketAction(ticketId, patch);
      if (r.ok) toast.success(r.message ?? "Updated");
      else toast.error(r.error);
      router.refresh();
    });
  return (
    <div className="space-y-4" aria-busy={pending}>
      <div className="space-y-1.5">
        <Label htmlFor="t-status">Status</Label>
        <NativeSelect id="t-status" defaultValue={status} disabled={pending} onChange={(e) => update({ status: e.target.value })}>
          <option value="open">Open</option>
          <option value="pending_customer">Awaiting customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-priority">Priority</Label>
        <NativeSelect id="t-priority" defaultValue={priority} disabled={pending} onChange={(e) => update({ priority: e.target.value })}>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-assignee">Assignee</Label>
        <NativeSelect id="t-assignee" defaultValue={assignedTo ?? ""} disabled={pending} onChange={(e) => update({ assigned_to: e.target.value || null })}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

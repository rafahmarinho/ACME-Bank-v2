import type { Metadata } from "next";
import { requireStaff } from "@/services/session";
import { listEvents } from "@/services/staff";
import { PageHeader } from "@/components/common/display";
import { FilterBar, Pagination } from "@/components/common/list-controls";
import { EventList } from "@/components/staff/event-list";

export const metadata: Metadata = { title: "Event log" };

const TYPES = [
  ["transfer", "Transfers"],
  ["settlement", "Settlements"],
  ["card", "Cards"],
  ["deposit", "Deposits"],
  ["review", "Reviews"],
  ["application", "Applications"],
  ["account", "Accounts"],
  ["fraud", "Fraud"],
  ["scenario", "Scenarios"],
  ["sim", "Simulation clock"],
  ["user", "Users"],
];

export default async function EventsPage({ searchParams }: PageProps<"/staff/events">) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const params = { q: s("q"), type: s("type"), severity: s("severity"), page: s("page") };
  const { supabase } = await requireStaff();
  const events = await listEvents(supabase, { ...params, page: Number(params.page ?? 1) });

  return (
    <div>
      <PageHeader title="Event log" description="Every simulated and staff action, newest first (simulation time)." />
      <FilterBar
        action="/staff/events"
        values={params}
        searchPlaceholder="Search event messages"
        filters={[
          { type: "select", name: "type", label: "Type", options: TYPES.map(([value, label]) => ({ value, label })) },
          {
            type: "select",
            name: "severity",
            label: "Severity",
            options: ["info", "success", "warning", "error"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
          },
        ]}
      />
      <div className="mt-4 rounded-xl border bg-card px-4">
        <EventList events={events.rows} />
      </div>
      <Pagination basePath="/staff/events" params={params} page={events.page} pageSize={events.pageSize} total={events.total} />
    </div>
  );
}

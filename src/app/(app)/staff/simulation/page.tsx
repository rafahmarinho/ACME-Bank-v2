import type { Metadata } from "next";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { requireAdmin } from "@/services/session";
import { getSimState, SCENARIOS } from "@/services/simulation";
import { listEvents, listPendingSettlements } from "@/services/staff";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/common/display";
import { EventList } from "@/components/staff/event-list";
import { AdvanceControls, AutoActivityToggle, ResetButton, ScenarioCard } from "@/components/staff/simulation-controls";
import { formatDateTime, formatDayHeading, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Simulation lab" };

export default async function SimulationPage() {
  const { supabase } = await requireAdmin();
  const [{ state, now }, events, pending] = await Promise.all([
    getSimState(supabase),
    listEvents(supabase, { page: 1 }),
    listPendingSettlements(supabase),
  ]);
  const flags = (state.flags ?? {}) as Record<string, boolean>;
  const activeModes = new Set([state.scenario, ...Object.keys(flags).filter((k) => flags[k])]);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Simulation lab"
        description="Drive the simulated bank: move the clock, trigger scenarios, inspect events and reset the demo."
        actions={<ResetButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="bg-sidebar text-sidebar-foreground ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock3 className="size-5 text-brand" /> Bank clock
            </CardTitle>
            <CardDescription className="text-sidebar-foreground/70">
              Advancing a day runs month-end interest and fees, settles pending ACH/wire/check items, executes scheduled payments and generates customer activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-3xl font-semibold text-white">{formatDayHeading(now)}</p>
              <p className="text-sm text-sidebar-foreground/70">
                {formatDateTime(now)} (New York) · scenario <span className="font-medium text-brand">{titleCase(state.scenario)}</span>
                {state.last_reset_at && <> · last reset {formatDateTime(state.last_reset_at)}</>}
              </p>
            </div>
            <div className="[&_button]:border-white/15 [&_button[data-variant=outline]]:bg-transparent [&_button[data-variant=outline]]:text-white">
              <AdvanceControls />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Engine</CardTitle>
            <CardDescription>{pending.length} item(s) waiting to settle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <AutoActivityToggle enabled={state.auto_activity} />
            <ul className="space-y-1 text-sm">
              {pending.slice(0, 5).map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="truncate">{t.description}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{t.rail?.toUpperCase() ?? t.kind}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 font-semibold">Scenarios</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SCENARIOS.map((s) => (
          <ScenarioCard key={s.code} code={s.code} title={s.title} description={s.description} mode={s.mode} active={s.mode && activeModes.has(s.code)} />
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardAction>
            <Link href="/staff/events" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Full event log
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent>
          <EventList events={events.rows.slice(0, 15)} compact />
        </CardContent>
      </Card>
    </div>
  );
}

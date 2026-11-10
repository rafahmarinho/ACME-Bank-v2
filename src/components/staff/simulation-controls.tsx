"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FastForward, Loader2, Play, RotateCcw, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/common/forms";
import { advanceSimulationAction, applyScenarioAction, processNowAction, resetDemoAction, setAutoActivityAction } from "@/actions/staff";
import { cn } from "@/lib/utils";

export function AdvanceControls() {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const router = useRouter();
  const advance = (days: number) => {
    setBusy(days);
    start(async () => {
      const r = await advanceSimulationAction(days);
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
      setBusy(null);
      router.refresh();
    });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 3, 7, 30].map((d) => (
        <Button key={d} onClick={() => advance(d)} disabled={pending} variant={d === 1 ? "default" : "outline"}>
          {busy === d ? <Loader2 className="animate-spin" /> : <FastForward />} +{d} day{d > 1 ? "s" : ""}
        </Button>
      ))}
      <ActionButton action={processNowAction} variant="ghost" size="default">
        <Play /> Process due items now
      </ActionButton>
    </div>
  );
}

export function AutoActivityToggle({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <span>
        <span className="block text-sm font-medium">Automatic customer activity</span>
        <span className="block text-xs text-muted-foreground">Demo customers shop, get paid and send money as days pass.</span>
      </span>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(v) =>
          start(async () => {
            const r = await setAutoActivityAction(Boolean(v));
            if (r.ok) toast.success(r.message);
            else toast.error(r.error);
            router.refresh();
          })
        }
      />
    </label>
  );
}

export function ScenarioCard({
  code,
  title,
  description,
  mode,
  active,
}: {
  code: string;
  title: string;
  description: string;
  mode: boolean;
  active: boolean;
}) {
  return (
    <div className={cn("flex flex-col rounded-xl border bg-card p-4", active && "border-brand ring-1 ring-brand")}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-medium">
          <Workflow className="size-4 text-brand" /> {title}
        </p>
        {active ? (
          <Badge className="bg-brand text-brand-foreground">
            <CheckCircle2 /> Active
          </Badge>
        ) : (
          <Badge variant="outline">{mode ? "Mode" : "One-off"}</Badge>
        )}
      </div>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-4">
        <ActionButton action={applyScenarioAction.bind(null, code)} variant={active ? "outline" : "default"}>
          <Play /> {mode && active ? "Re-apply" : "Run scenario"}
        </ActionButton>
      </div>
    </div>
  );
}

export function ResetButton() {
  return (
    <ActionButton
      action={resetDemoAction}
      variant="destructive"
      size="default"
      confirm={{
        title: "Reset all demo data?",
        description:
          "Every account, transaction, card, beneficiary, ticket and event will be deleted and two fresh months of activity generated for the six demo customers. Demo passwords are restored. This takes a few seconds and cannot be undone.",
        confirmLabel: "Reset demo data",
        destructive: true,
      }}
    >
      <RotateCcw /> Reset demo data
    </ActionButton>
  );
}

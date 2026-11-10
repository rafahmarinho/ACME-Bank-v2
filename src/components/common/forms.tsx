"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

export function Field({
  label,
  name,
  error,
  hint,
  className,
  children,
  ...input
}: React.ComponentProps<"input"> & {
  label: string;
  name: string;
  error?: string;
  hint?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const id = input.id ?? `f-${name}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children ?? <Input id={id} name={name} aria-invalid={Boolean(error) || undefined} {...input} />}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

export function MoneyInput({ name, defaultValue, error, ...rest }: React.ComponentProps<"input"> & { error?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">$</span>
      <Input
        name={name}
        id={rest.id ?? `f-${name}`}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        defaultValue={defaultValue}
        aria-invalid={Boolean(error) || undefined}
        className="pl-7 tabular"
        {...rest}
      />
    </div>
  );
}

export function NativeSelect({ className, error, ...props }: React.ComponentProps<"select"> & { error?: string }) {
  return (
    <select
      aria-invalid={Boolean(error) || undefined}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30 [&>option]:bg-popover",
        className,
      )}
      {...props}
    />
  );
}

/** Switch that submits "on" through a hidden input, so it works with FormData. */
export function FormSwitch({
  name,
  defaultChecked,
  label,
  description,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  description?: string;
}) {
  const [checked, setChecked] = useState(Boolean(defaultChecked));
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      {checked && <input type="hidden" name={name} value="on" />}
      <Switch checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} aria-label={label} />
    </label>
  );
}

export function SubmitButton({ children, className, pendingLabel, ...props }: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} className={cn("min-w-28", className)} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.ok && !state.message) return null;
  return (
    <Alert variant={state.ok ? "default" : "destructive"} className={cn(state.ok && "border-success/30 bg-success/8 text-success")}>
      <AlertDescription className={cn(state.ok && "text-success")}>{state.ok ? state.message : state.error}</AlertDescription>
    </Alert>
  );
}

/** Toasts the result of a useActionState form and runs onSuccess once per result. */
export function useActionToast(state: ActionResult | null, onSuccess?: () => void) {
  const last = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    } else if (!state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);
}

/** Button that runs a server action (optionally after confirmation) and toasts the result. */
export function ActionButton({
  action,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  confirm?: { title: string; description: React.ReactNode; confirmLabel?: string; destructive?: boolean };
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const run = () =>
    start(async () => {
      const r = await action();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={pending || disabled}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {pending && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription render={<div />}>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel>
              <Button variant={confirm.destructive ? "destructive" : "default"} disabled={pending} onClick={run}>
                {pending && <Loader2 className="animate-spin" />}
                {confirm.confirmLabel ?? "Confirm"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

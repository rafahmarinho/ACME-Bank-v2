import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };
export type FilterDef =
  | { type: "select"; name: string; label: string; options: Option[] }
  | { type: "date"; name: string; label: string };

const selectClass =
  "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30 [&>option]:bg-popover";

/** URL-driven search + filters (works without JavaScript; soft navigation with it). */
export function FilterBar({
  action,
  values,
  filters = [],
  searchPlaceholder = "Search",
  hidden = {},
}: {
  action: string;
  values: Record<string, string | undefined>;
  filters?: FilterDef[];
  searchPlaceholder?: string;
  hidden?: Record<string, string>;
}) {
  const active = Object.entries(values).some(([k, v]) => v && k !== "page" && !(k in hidden));
  return (
    <Form action={action} className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:flex-wrap md:items-end">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="relative min-w-0 flex-1 md:min-w-56">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={values.q ?? ""} placeholder={searchPlaceholder} className="pl-8" />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {filters.map((f) =>
          f.type === "select" ? (
            <label key={f.name} className="space-y-1">
              <span className="block text-[11px] font-medium text-muted-foreground">{f.label}</span>
              <select name={f.name} defaultValue={values[f.name] ?? ""} className={cn(selectClass, "w-full sm:w-auto")}>
                <option value="">All</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label key={f.name} className="space-y-1">
              <span className="block text-[11px] font-medium text-muted-foreground">{f.label}</span>
              <Input type="date" name={f.name} defaultValue={values[f.name] ?? ""} className="w-full sm:w-38" />
            </label>
          ),
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 md:flex-none">
          Apply
        </Button>
        {active && (
          <Link
            href={`${action}${Object.keys(hidden).length ? `?${new URLSearchParams(hidden)}` : ""}`}
            className={buttonVariants({ variant: "ghost" })}
          >
            <X className="size-4" /> Clear
          </Link>
        )}
      </div>
    </Form>
  );
}

export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && sp.set(k, v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-1">
        <Link
          aria-disabled={page <= 1}
          href={href(page - 1)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-40")}
        >
          <ChevronLeft className="size-4" /> Prev
        </Link>
        <Link
          aria-disabled={page >= pages}
          href={href(page + 1)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-40")}
        >
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

import { FileDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, initials } from "@/lib/format";

type Message = {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  attachment_name: string | null;
  attachment_url: string | null;
  author_id: string | null;
  author: { full_name: string; role: string } | null;
};

export function TicketThread({ messages, viewerId }: { messages: Message[]; viewerId: string }) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const mine = m.author_id === viewerId;
        const staff = m.author?.role === "support" || m.author?.role === "admin";
        return (
          <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                staff ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground",
              )}
            >
              {initials(m.author?.full_name)}
            </span>
            <div className={cn("max-w-[80%] space-y-1", mine && "items-end text-right")}>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.author?.full_name ?? "ACME"}</span>
                {staff && " · ACME Support"} · {formatDateTime(m.created_at)}
              </p>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-left text-sm whitespace-pre-wrap",
                  m.is_internal
                    ? "border border-dashed border-warning bg-warning/10"
                    : mine
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card",
                )}
              >
                {m.is_internal && (
                  <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-warning">
                    <Lock className="size-3" /> Internal note
                  </span>
                )}
                {m.body}
                {m.attachment_url && (
                  <a
                    href={m.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium underline", mine && !m.is_internal ? "text-primary-foreground" : "text-primary dark:text-brand")}
                  >
                    <FileDown className="size-3.5" /> {m.attachment_name}
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

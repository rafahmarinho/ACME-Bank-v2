"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Supabase Realtime and refreshes server components when the
 * user's data changes (new notifications, balances, transactions, simulation clock).
 */
export function RealtimeSync({ userId, staff }: { userId: string; staff: boolean }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 600);
    };

    const channel = supabase
      .channel(`acme-sync-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as { title: string; body: string; kind: string };
        const fn = n.kind === "error" ? toast.error : n.kind === "warning" ? toast.warning : n.kind === "success" ? toast.success : toast.info;
        fn(n.title, { description: n.body });
        refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "sim_state" }, refresh);

    if (staff) {
      channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "sim_events" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh);
    }

    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router, userId, staff]);

  return null;
}

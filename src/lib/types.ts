import type { Database, Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;
export type Account = Tables<"accounts">;
export type Transaction = Tables<"transactions">;
export type LedgerEntry = Tables<"ledger_entries">;
export type Beneficiary = Tables<"beneficiaries">;
export type Card = Tables<"cards">;
export type ScheduledPayment = Tables<"scheduled_payments">;
export type SupportTicket = Tables<"support_tickets">;
export type TicketMessage = Tables<"ticket_messages">;
export type Notification = Tables<"notifications">;
export type SimEvent = Tables<"sim_events">;
export type SimState = Tables<"sim_state">;
export type Fee = Tables<"fee_schedule">;
export type AccountApplication = Tables<"account_applications">;
export type Activity = Database["public"]["Views"]["account_activity"]["Row"];

export type UserRole = Database["public"]["Enums"]["user_role"];
export type TransferRail = Database["public"]["Enums"]["transfer_rail"];
export type TxnStatus = Database["public"]["Enums"]["txn_status"];
export type TxnKind = Database["public"]["Enums"]["txn_kind"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
export type ScheduleFrequency = Database["public"]["Enums"]["schedule_frequency"];

export type Preferences = {
  email_alerts: boolean;
  push_alerts: boolean;
  low_balance_alert_cents: number;
  large_transaction_alert_cents: number;
  marketing_emails: boolean;
  theme: "system" | "light" | "dark";
};

export type TransferQuote = {
  rail: TransferRail;
  fee_cents: number;
  total_cents: number;
  available_cents: number;
  sufficient_funds: boolean;
  daily_limit_cents: number;
  limit_remaining_cents: number | null;
  within_limit: boolean;
  requires_review: boolean;
  internal: boolean;
  eta: string;
};

export type TransferResult = {
  id: string;
  reference: string;
  status: TxnStatus;
  fee_cents: number;
  failure_reason?: string;
  requires_review?: boolean;
  settles_at?: string;
};

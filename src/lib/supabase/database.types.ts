
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "account_applications": {
                  Row: {
                    "account_id": string | null,"account_type": Database["public"]['Enums']["account_type"],"address_line1": string,"annual_income_cents": number,"city": string,"created_at": string,"date_of_birth": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"employment_status": string,"full_name": string,"id": string,"initial_deposit_cents": number,"phone": string,"postal_code": string,"risk_score": number,"ssn_last4": string,"state": string,"status": Database["public"]['Enums']["application_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"account_type"?: Database["public"]['Enums']["account_type"],"address_line1": string,"annual_income_cents"?: number,"city": string,"created_at"?: string,"date_of_birth": string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"employment_status": string,"full_name": string,"id"?: string,"initial_deposit_cents"?: number,"phone": string,"postal_code": string,"risk_score"?: number,"ssn_last4": string,"state": string,"status"?: Database["public"]['Enums']["application_status"],"user_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"account_type"?: Database["public"]['Enums']["account_type"],"address_line1"?: string,"annual_income_cents"?: number,"city"?: string,"created_at"?: string,"date_of_birth"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"employment_status"?: string,"full_name"?: string,"id"?: string,"initial_deposit_cents"?: number,"phone"?: string,"postal_code"?: string,"risk_score"?: number,"ssn_last4"?: string,"state"?: string,"status"?: Database["public"]['Enums']["application_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_applications_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_applications_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"accounts": {
                  Row: {
                    "account_number": string,"available_cents": number | null,"balance_cents": number,"created_at": string,"currency": string,"daily_transfer_limit_cents": number,"id": string,"interest_rate_bps": number,"is_system": boolean,"nickname": string,"opened_at": string,"owner_id": string | null,"pending_debits_cents": number,"routing_number": string,"status": Database["public"]['Enums']["account_status"],"status_reason": string | null,"system_code": string | null,"type": Database["public"]['Enums']["account_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_number": string,"available_cents"?: never,"balance_cents"?: number,"created_at"?: string,"currency"?: string,"daily_transfer_limit_cents"?: number,"id"?: string,"interest_rate_bps"?: number,"is_system"?: boolean,"nickname": string,"opened_at"?: string,"owner_id"?: string | null,"pending_debits_cents"?: number,"routing_number"?: string,"status"?: Database["public"]['Enums']["account_status"],"status_reason"?: string | null,"system_code"?: string | null,"type"?: Database["public"]['Enums']["account_type"],"updated_at"?: string
                  }
                  Update: {
                    "account_number"?: string,"available_cents"?: never,"balance_cents"?: number,"created_at"?: string,"currency"?: string,"daily_transfer_limit_cents"?: number,"id"?: string,"interest_rate_bps"?: number,"is_system"?: boolean,"nickname"?: string,"opened_at"?: string,"owner_id"?: string | null,"pending_debits_cents"?: number,"routing_number"?: string,"status"?: Database["public"]['Enums']["account_status"],"status_reason"?: string | null,"system_code"?: string | null,"type"?: Database["public"]['Enums']["account_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"beneficiaries": {
                  Row: {
                    "account_number": string,"bank_name": string,"created_at": string,"email": string | null,"id": string,"internal_account_id": string | null,"is_favorite": boolean,"name": string,"nickname": string | null,"owner_id": string,"routing_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_number": string,"bank_name"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"internal_account_id"?: string | null,"is_favorite"?: boolean,"name": string,"nickname"?: string | null,"owner_id": string,"routing_number": string
                  }
                  Update: {
                    "account_number"?: string,"bank_name"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"internal_account_id"?: string | null,"is_favorite"?: boolean,"name"?: string,"nickname"?: string | null,"owner_id"?: string,"routing_number"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "beneficiaries_internal_account_id_fkey"
      columns: ["internal_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "beneficiaries_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "account_id": string,"brand": string,"cardholder_name": string,"contactless_enabled": boolean,"created_at": string,"daily_limit_cents": number,"expiry_month": number,"expiry_year": number,"id": string,"international_enabled": boolean,"issued_at": string,"last4": string,"monthly_limit_cents": number,"online_enabled": boolean,"owner_id": string,"status": Database["public"]['Enums']["card_status"],"status_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"brand"?: string,"cardholder_name": string,"contactless_enabled"?: boolean,"created_at"?: string,"daily_limit_cents"?: number,"expiry_month": number,"expiry_year": number,"id"?: string,"international_enabled"?: boolean,"issued_at"?: string,"last4": string,"monthly_limit_cents"?: number,"online_enabled"?: boolean,"owner_id": string,"status"?: Database["public"]['Enums']["card_status"],"status_reason"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"brand"?: string,"cardholder_name"?: string,"contactless_enabled"?: boolean,"created_at"?: string,"daily_limit_cents"?: number,"expiry_month"?: number,"expiry_year"?: number,"id"?: string,"international_enabled"?: boolean,"issued_at"?: string,"last4"?: string,"monthly_limit_cents"?: number,"online_enabled"?: boolean,"owner_id"?: string,"status"?: Database["public"]['Enums']["card_status"],"status_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_schedule": {
                  Row: {
                    "code": string,"description": string,"flat_cents": number,"max_cents": number | null,"min_cents": number,"name": string,"percent_bps": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"description": string,"flat_cents"?: number,"max_cents"?: number | null,"min_cents"?: number,"name": string,"percent_bps"?: number
                  }
                  Update: {
                    "code"?: string,"description"?: string,"flat_cents"?: number,"max_cents"?: number | null,"min_cents"?: number,"name"?: string,"percent_bps"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ledger_entries": {
                  Row: {
                    "account_id": string,"amount_cents": number,"balance_after_cents": number,"created_at": string,"direction": Database["public"]['Enums']["entry_direction"],"id": number,"memo": string | null,"transaction_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_cents": number,"balance_after_cents": number,"created_at": string,"direction": Database["public"]['Enums']["entry_direction"],"id"?: never,"memo"?: string | null,"transaction_id": string
                  }
                  Update: {
                    "account_id"?: string,"amount_cents"?: number,"balance_after_cents"?: number,"created_at"?: string,"direction"?: Database["public"]['Enums']["entry_direction"],"id"?: never,"memo"?: string | null,"transaction_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"kind": string,"link": string | null,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "address_line1": string | null,"avatar_path": string | null,"city": string | null,"created_at": string,"customer_number": string | null,"date_of_birth": string | null,"email": string,"full_name": string,"id": string,"is_demo": boolean,"kyc_status": string,"persona": string | null,"phone": string | null,"postal_code": string | null,"preferences": NonNullable<Json>,"role": Database["public"]['Enums']["user_role"],"state": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1"?: string | null,"avatar_path"?: string | null,"city"?: string | null,"created_at"?: string,"customer_number"?: string | null,"date_of_birth"?: string | null,"email": string,"full_name"?: string,"id": string,"is_demo"?: boolean,"kyc_status"?: string,"persona"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"preferences"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["user_role"],"state"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address_line1"?: string | null,"avatar_path"?: string | null,"city"?: string | null,"created_at"?: string,"customer_number"?: string | null,"date_of_birth"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"is_demo"?: boolean,"kyc_status"?: string,"persona"?: string | null,"phone"?: string | null,"postal_code"?: string | null,"preferences"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["user_role"],"state"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scheduled_payments": {
                  Row: {
                    "amount_cents": number,"beneficiary_id": string | null,"created_at": string,"description": string,"end_date": string | null,"frequency": Database["public"]['Enums']["schedule_frequency"],"from_account_id": string,"id": string,"last_result": string | null,"last_run_at": string | null,"next_run_date": string,"owner_id": string,"run_count": number,"status": Database["public"]['Enums']["schedule_status"],"to_account_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"beneficiary_id"?: string | null,"created_at"?: string,"description": string,"end_date"?: string | null,"frequency"?: Database["public"]['Enums']["schedule_frequency"],"from_account_id": string,"id"?: string,"last_result"?: string | null,"last_run_at"?: string | null,"next_run_date": string,"owner_id": string,"run_count"?: number,"status"?: Database["public"]['Enums']["schedule_status"],"to_account_id"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"beneficiary_id"?: string | null,"created_at"?: string,"description"?: string,"end_date"?: string | null,"frequency"?: Database["public"]['Enums']["schedule_frequency"],"from_account_id"?: string,"id"?: string,"last_result"?: string | null,"last_run_at"?: string | null,"next_run_date"?: string,"owner_id"?: string,"run_count"?: number,"status"?: Database["public"]['Enums']["schedule_status"],"to_account_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "scheduled_payments_beneficiary_id_fkey"
      columns: ["beneficiary_id"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scheduled_payments_from_account_id_fkey"
      columns: ["from_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scheduled_payments_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scheduled_payments_to_account_id_fkey"
      columns: ["to_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"sim_events": {
                  Row: {
                    "account_id": string | null,"actor_id": string | null,"created_at": string,"id": number,"message": string,"occurred_at": string,"payload": NonNullable<Json>,"severity": string,"subject_user_id": string | null,"transaction_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"message": string,"occurred_at"?: string,"payload"?: NonNullable<Json>,"severity"?: string,"subject_user_id"?: string | null,"transaction_id"?: string | null,"type": string
                  }
                  Update: {
                    "account_id"?: string | null,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"message"?: string,"occurred_at"?: string,"payload"?: NonNullable<Json>,"severity"?: string,"subject_user_id"?: string | null,"transaction_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sim_events_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sim_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sim_events_subject_user_id_fkey"
      columns: ["subject_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sim_events_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"sim_state": {
                  Row: {
                    "anchor_real": string,"anchor_ts": string,"auto_activity": boolean,"flags": NonNullable<Json>,"id": number,"last_reset_at": string | null,"scenario": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor_real"?: string,"anchor_ts"?: string,"auto_activity"?: boolean,"flags"?: NonNullable<Json>,"id"?: number,"last_reset_at"?: string | null,"scenario"?: string,"updated_at"?: string
                  }
                  Update: {
                    "anchor_real"?: string,"anchor_ts"?: string,"auto_activity"?: boolean,"flags"?: NonNullable<Json>,"id"?: number,"last_reset_at"?: string | null,"scenario"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"support_tickets": {
                  Row: {
                    "assigned_to": string | null,"category": string,"created_at": string,"customer_id": string,"id": string,"number": number,"priority": Database["public"]['Enums']["ticket_priority"],"status": Database["public"]['Enums']["ticket_status"],"subject": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"category"?: string,"created_at"?: string,"customer_id": string,"id"?: string,"number"?: never,"priority"?: Database["public"]['Enums']["ticket_priority"],"status"?: Database["public"]['Enums']["ticket_status"],"subject": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"category"?: string,"created_at"?: string,"customer_id"?: string,"id"?: string,"number"?: never,"priority"?: Database["public"]['Enums']["ticket_priority"],"status"?: Database["public"]['Enums']["ticket_status"],"subject"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_tickets_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_path": string | null,"author_id": string | null,"body": string,"created_at": string,"id": string,"is_internal": boolean,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"is_internal"?: boolean,"ticket_id": string
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"is_internal"?: boolean,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ticket_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"amount_cents": number,"beneficiary_id": string | null,"card_id": string | null,"category": string,"counterparty_account_id": string | null,"counterparty_name": string | null,"created_at": string,"description": string,"direction": Database["public"]['Enums']["entry_direction"],"failure_reason": string | null,"fee_cents": number,"hold_cents": number,"id": string,"idempotency_key": string | null,"initiated_by": string | null,"is_own_transfer": boolean,"kind": Database["public"]['Enums']["txn_kind"],"metadata": NonNullable<Json>,"posted_at": string | null,"rail": Database["public"]['Enums']["transfer_rail"] | null,"recipient_description": string | null,"reference": string,"requires_review": boolean,"review_note": string | null,"scheduled_payment_id": string | null,"settles_at": string | null,"status": Database["public"]['Enums']["txn_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount_cents": number,"beneficiary_id"?: string | null,"card_id"?: string | null,"category"?: string,"counterparty_account_id"?: string | null,"counterparty_name"?: string | null,"created_at"?: string,"description": string,"direction": Database["public"]['Enums']["entry_direction"],"failure_reason"?: string | null,"fee_cents"?: number,"hold_cents"?: number,"id"?: string,"idempotency_key"?: string | null,"initiated_by"?: string | null,"is_own_transfer"?: boolean,"kind": Database["public"]['Enums']["txn_kind"],"metadata"?: NonNullable<Json>,"posted_at"?: string | null,"rail"?: Database["public"]['Enums']["transfer_rail"] | null,"recipient_description"?: string | null,"reference"?: string,"requires_review"?: boolean,"review_note"?: string | null,"scheduled_payment_id"?: string | null,"settles_at"?: string | null,"status"?: Database["public"]['Enums']["txn_status"]
                  }
                  Update: {
                    "account_id"?: string,"amount_cents"?: number,"beneficiary_id"?: string | null,"card_id"?: string | null,"category"?: string,"counterparty_account_id"?: string | null,"counterparty_name"?: string | null,"created_at"?: string,"description"?: string,"direction"?: Database["public"]['Enums']["entry_direction"],"failure_reason"?: string | null,"fee_cents"?: number,"hold_cents"?: number,"id"?: string,"idempotency_key"?: string | null,"initiated_by"?: string | null,"is_own_transfer"?: boolean,"kind"?: Database["public"]['Enums']["txn_kind"],"metadata"?: NonNullable<Json>,"posted_at"?: string | null,"rail"?: Database["public"]['Enums']["transfer_rail"] | null,"recipient_description"?: string | null,"reference"?: string,"requires_review"?: boolean,"review_note"?: string | null,"scheduled_payment_id"?: string | null,"settles_at"?: string | null,"status"?: Database["public"]['Enums']["txn_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_beneficiary_id_fkey"
      columns: ["beneficiary_id"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_counterparty_account_id_fkey"
      columns: ["counterparty_account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_initiated_by_fkey"
      columns: ["initiated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_scheduled_payment_id_fkey"
      columns: ["scheduled_payment_id"]
isOneToOne: false
      referencedRelation: "scheduled_payments"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "account_activity": {
                  Row: {
                    "account_id": string | null,"amount_cents": number | null,"card_id": string | null,"category": string | null,"counterparty_name": string | null,"created_at": string | null,"description": string | null,"direction": Database["public"]['Enums']["entry_direction"] | null,"failure_reason": string | null,"fee_cents": number | null,"id": string | null,"kind": Database["public"]['Enums']["txn_kind"] | null,"posted_at": string | null,"rail": Database["public"]['Enums']["transfer_rail"] | null,"reference": string | null,"requires_review": boolean | null,"settles_at": string | null,"signed_amount_cents": number | null,"status": Database["public"]['Enums']["txn_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"cancel_transfer":
{ Args: { "p_txn": string }; Returns: undefined
                           },
"create_transfer":
{ Args: { "p_amount": number,"p_beneficiary"?: string,"p_from": string,"p_idempotency_key"?: string,"p_memo"?: string,"p_rail"?: Database["public"]['Enums']["transfer_rail"],"p_to_account"?: string }; Returns: Json
                           },
"decide_application":
{ Args: { "p_app": string,"p_approve": boolean,"p_note"?: string }; Returns: undefined
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"open_additional_account":
{ Args: { "p_initial_deposit"?: number,"p_nickname": string,"p_type": Database["public"]['Enums']["account_type"] }; Returns: string
                           },
"owns_account":
{ Args: { "p_account": string }; Returns: boolean
                           },
"quote_transfer":
{ Args: { "p_amount": number,"p_beneficiary"?: string,"p_from": string,"p_rail"?: Database["public"]['Enums']["transfer_rail"],"p_to_account"?: string }; Returns: Json
                           },
"replace_card":
{ Args: { "p_card": string }; Returns: Json
                           },
"review_transfer":
{ Args: { "p_approve": boolean,"p_note"?: string,"p_txn": string }; Returns: Json
                           },
"run_scheduled_payment_now":
{ Args: { "p_id": string }; Returns: Json
                           },
"set_account_status":
{ Args: { "p_account": string,"p_reason"?: string,"p_status": Database["public"]['Enums']["account_status"] }; Returns: undefined
                           },
"set_card_status":
{ Args: { "p_card": string,"p_locked": boolean,"p_reason"?: string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user": string }; Returns: undefined
                           },
"sim_advance":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"sim_apply_scenario":
{ Args: { "p_code": string }; Returns: Json
                           },
"sim_now":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"sim_process_now":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"sim_reset_demo":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"sim_set_auto_activity":
{ Args: { "p_enabled": boolean }; Returns: undefined
                           },
"simulate_card_purchase":
{ Args: { "p_amount": number,"p_card": string,"p_category"?: string,"p_channel"?: string,"p_international"?: boolean,"p_merchant": string }; Returns: Json
                           },
"simulate_deposit":
{ Args: { "p_account": string,"p_amount": number,"p_description"?: string,"p_method"?: string }; Returns: Json
                           },
"submit_account_application":
{ Args: { "p_account_type": Database["public"]['Enums']["account_type"],"p_address_line1": string,"p_annual_income": number,"p_city": string,"p_date_of_birth": string,"p_employment_status": string,"p_full_name": string,"p_initial_deposit": number,"p_phone": string,"p_postal_code": string,"p_ssn_last4": string,"p_state": string }; Returns: Json
                           },
"update_card_settings":
{ Args: { "p_card": string,"p_contactless": boolean,"p_daily_limit": number,"p_international": boolean,"p_monthly_limit": number,"p_online": boolean }; Returns: undefined
                           },
"update_transfer_limit":
{ Args: { "p_account": string,"p_limit": number }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "active"|"frozen"|"closed","account_type": "checking"|"savings","application_status": "pending_review"|"approved"|"rejected","card_status": "active"|"locked"|"cancelled","entry_direction": "debit"|"credit","schedule_frequency": "once"|"weekly"|"biweekly"|"monthly","schedule_status": "active"|"paused"|"completed"|"cancelled","ticket_priority": "low"|"normal"|"high"|"urgent","ticket_status": "open"|"pending_customer"|"resolved"|"closed","transfer_rail": "internal"|"ach"|"instant"|"wire","txn_kind": "opening_deposit"|"deposit"|"payroll"|"transfer"|"bill_payment"|"card_purchase"|"fee"|"interest"|"refund"|"withdrawal","txn_status": "pending"|"posted"|"failed"|"cancelled","user_role": "customer"|"support"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["active", "frozen", "closed"],"account_type": ["checking", "savings"],"application_status": ["pending_review", "approved", "rejected"],"card_status": ["active", "locked", "cancelled"],"entry_direction": ["debit", "credit"],"schedule_frequency": ["once", "weekly", "biweekly", "monthly"],"schedule_status": ["active", "paused", "completed", "cancelled"],"ticket_priority": ["low", "normal", "high", "urgent"],"ticket_status": ["open", "pending_customer", "resolved", "closed"],"transfer_rail": ["internal", "ach", "instant", "wire"],"txn_kind": ["opening_deposit", "deposit", "payroll", "transfer", "bill_payment", "card_purchase", "fee", "interest", "refund", "withdrawal"],"txn_status": ["pending", "posted", "failed", "cancelled"],"user_role": ["customer", "support", "admin"]
          }
        }
} as const

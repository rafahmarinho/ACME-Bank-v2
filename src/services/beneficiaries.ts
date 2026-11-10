import "server-only";
import type { DbClient } from "@/lib/supabase/server";

export async function listBeneficiaries(db: DbClient, ownerId: string) {
  const { data, error } = await db
    .from("beneficiaries")
    .select("*")
    .eq("owner_id", ownerId)
    .order("is_favorite", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

export type BeneficiaryInput = {
  name: string;
  nickname?: string | null;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  email?: string | null;
  isFavorite?: boolean;
};

export async function createBeneficiary(db: DbClient, ownerId: string, input: BeneficiaryInput) {
  const { data, error } = await db
    .from("beneficiaries")
    .insert({
      owner_id: ownerId,
      name: input.name,
      nickname: input.nickname || null,
      bank_name: input.bankName,
      account_number: input.accountNumber,
      routing_number: input.routingNumber,
      email: input.email || null,
      is_favorite: input.isFavorite ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBeneficiary(db: DbClient, id: string, input: Partial<BeneficiaryInput>) {
  const { error } = await db
    .from("beneficiaries")
    .update({
      name: input.name,
      nickname: input.nickname,
      bank_name: input.bankName,
      email: input.email,
      is_favorite: input.isFavorite,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBeneficiary(db: DbClient, id: string) {
  const { count } = await db
    .from("scheduled_payments")
    .select("id", { count: "exact", head: true })
    .eq("beneficiary_id", id)
    .eq("status", "active");
  if (count) throw new Error("This beneficiary has active scheduled payments. Cancel them first.");
  const { error } = await db.from("beneficiaries").delete().eq("id", id);
  if (error) throw error;
}

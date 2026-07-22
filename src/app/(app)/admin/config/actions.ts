"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface ConfigState {
  ok?: boolean;
  error?: string;
}

export async function saveConfig(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };

  const mode = String(formData.get("otp_box_mode") ?? "count");
  const size = parseInt(String(formData.get("otp_box_size") ?? "70"), 10);
  const cartonSize = parseInt(String(formData.get("carton_size") ?? "40"), 10);
  const palletSize = parseInt(String(formData.get("pallet_size") ?? "35"), 10);

  if (mode !== "count" && mode !== "product") return { error: "Invalid mode." };
  const inRange = (n: number) => Number.isFinite(n) && n >= 1 && n <= 100000;
  if (!inRange(size)) return { error: "Box size must be between 1 and 100000." };
  if (!inRange(cartonSize)) return { error: "Carton size must be between 1 and 100000." };
  if (!inRange(palletSize)) return { error: "Pallet size must be between 1 and 100000." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_config")
    .update({ otp_box_mode: mode, otp_box_size: size, carton_size: cartonSize, pallet_size: palletSize })
    .eq("id", true);

  if (error) return { error: error.message };
  revalidatePath("/admin/config");
  return { ok: true };
}

/** Add a product model (admin) — used by the Scan PF model picker. */
export async function addModel(reference: string, name: string): Promise<ConfigState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };
  const ref = reference.trim();
  const nm = name.trim() || ref;
  if (!ref) return { error: "A model reference is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("models").insert({ reference: ref, name: nm });
  if (error) return { error: error.message };
  revalidatePath("/admin/config");
  return { ok: true };
}

/** Remove a product model (admin). */
export async function deleteModel(id: string): Promise<ConfigState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };
  const supabase = await createClient();
  const { error } = await supabase.from("models").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/config");
  return { ok: true };
}

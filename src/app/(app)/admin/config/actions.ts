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

  if (mode !== "count" && mode !== "product") return { error: "Invalid mode." };
  if (!Number.isFinite(size) || size < 1 || size > 100000) return { error: "Box size must be between 1 and 100000." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_config")
    .update({ otp_box_mode: mode, otp_box_size: size })
    .eq("id", true);

  if (error) return { error: error.message };
  revalidatePath("/admin/config");
  return { ok: true };
}

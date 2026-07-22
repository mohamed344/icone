"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isSupervisor, type Role } from "@/lib/workflow";

export interface CarteDimoLink {
  id: string;
  carteCode: string;
  dimoCode: string;
  by: string | null;
  at: string;
}

interface Row {
  id: string;
  carte_code: string;
  dimo_code: string;
  created_by: string | null;
  created_at: string;
}

/**
 * Carte↔dimo links for the admin lookup, newest first. An optional search
 * matches either the carte or the dimo code (case-insensitive, partial).
 */
export async function getCarteDimoLinks(search?: string): Promise<CarteDimoLink[]> {
  const session = await getSessionUser();
  if (!isSupervisor(session?.profile?.role as Role)) return [];

  const supabase = await createClient();
  let query = supabase
    .from("carte_dimo_links")
    .select("id, carte_code, dimo_code, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const s = search?.trim();
  if (s) query = query.or(`carte_code.ilike.%${s}%,dimo_code.ilike.%${s}%`);

  const { data } = await query;
  const rows = (data as Row[]) ?? [];

  // Resolve creator display names in one lookup.
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profiles as { id: string; full_name: string | null }[]) ?? []) {
      if (p.full_name) names.set(p.id, p.full_name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    carteCode: r.carte_code,
    dimoCode: r.dimo_code,
    by: r.created_by ? (names.get(r.created_by) ?? null) : null,
    at: r.created_at,
  }));
}

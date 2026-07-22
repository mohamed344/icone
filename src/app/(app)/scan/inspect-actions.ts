"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Container traceability (the Track screen). Scan any box / carton / pallet code
 * and drill into what's inside it:
 *   - box    → the carte serials scanned into it at OTP
 *   - carton → its cartes (serial + linked dimo barcode)
 *   - pallet → its cartons, each expanded to its cartes + dimos
 * Read-only; every authenticated user may look up.
 */

export interface CarteMember {
  serial: string;
  /** The carte's linked dimo barcode (null before Binding). */
  dimo: string | null;
}

export interface InspectCarton {
  id: string;
  code: string | null;
  cartonNumber: number;
  count: number;
  model: string | null;
  members: CarteMember[];
}

export type InspectResult =
  | { kind: "box"; code: string; boxNumber: number; product: string | null; members: string[] }
  | { kind: "carton"; carton: InspectCarton }
  | { kind: "pallet"; code: string; palletNumber: number; cartons: InspectCarton[] }
  | { kind: "none" };

type Db = Awaited<ReturnType<typeof createClient>>;

/** Resolve each serial's dimo barcode from carte_dimo_links (one query). */
async function dimosFor(supabase: Db, serials: string[]): Promise<Map<string, string>> {
  if (serials.length === 0) return new Map();
  const { data } = await supabase
    .from("carte_dimo_links")
    .select("carte_code, dimo_code")
    .in("carte_code", serials);
  return new Map(
    ((data as { carte_code: string; dimo_code: string }[]) ?? []).map((l) => [l.carte_code, l.dimo_code]),
  );
}

/** Build a carton's member list (serial + dimo) from its id. */
async function cartonMembers(supabase: Db, cartonId: string): Promise<CarteMember[]> {
  const { data: units } = await supabase
    .from("pipeline_units")
    .select("serial")
    .eq("carton_id", cartonId)
    .order("serial");
  const serials = ((units as { serial: string }[]) ?? []).map((u) => u.serial);
  const byCarte = await dimosFor(supabase, serials);
  return serials.map((serial) => ({ serial, dimo: byCarte.get(serial) ?? null }));
}

export async function inspectCode(code: string): Promise<InspectResult> {
  const c = code?.trim();
  if (!c) return { kind: "none" };
  const session = await getSessionUser();
  if (!session?.profile) return { kind: "none" };
  const supabase = await createClient();

  // Box — cartes are tracked via scan_events tagged with the box id at OTP.
  const { data: box } = await supabase
    .from("otp_boxes")
    .select("id, box_number, box_code, product")
    .eq("box_code", c)
    .maybeSingle();
  if (box) {
    const { data: members } = await supabase
      .from("scan_events")
      .select("code")
      .eq("stage", "otp_validation")
      .contains("meta", { otp_box_id: box.id });
    const codes = [...new Set(((members as { code: string }[]) ?? []).map((m) => m.code))].sort();
    return { kind: "box", code: box.box_code as string, boxNumber: box.box_number, product: box.product, members: codes };
  }

  // Carton.
  const { data: carton } = await supabase
    .from("pipeline_cartons")
    .select("id, code, carton_number, count, model")
    .eq("code", c)
    .maybeSingle();
  if (carton) {
    return {
      kind: "carton",
      carton: {
        id: carton.id,
        code: carton.code,
        cartonNumber: carton.carton_number,
        count: carton.count,
        model: carton.model,
        members: await cartonMembers(supabase, carton.id),
      },
    };
  }

  // Pallet — expand each of its cartons.
  const { data: pallet } = await supabase
    .from("pipeline_pallets")
    .select("id, code, pallet_number")
    .eq("code", c)
    .maybeSingle();
  if (pallet) {
    const { data: cartons } = await supabase
      .from("pipeline_cartons")
      .select("id, code, carton_number, count, model")
      .eq("pallet_id", pallet.id)
      .order("carton_number");
    const rows = (cartons as { id: string; code: string | null; carton_number: number; count: number; model: string | null }[]) ?? [];
    const expanded: InspectCarton[] = [];
    for (const ct of rows) {
      expanded.push({
        id: ct.id,
        code: ct.code,
        cartonNumber: ct.carton_number,
        count: ct.count,
        model: ct.model,
        members: await cartonMembers(supabase, ct.id),
      });
    }
    return { kind: "pallet", code: pallet.code as string, palletNumber: pallet.pallet_number, cartons: expanded };
  }

  return { kind: "none" };
}

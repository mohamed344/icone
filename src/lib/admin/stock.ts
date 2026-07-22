import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface StockCartonRow {
  id: string;
  code: string | null;
  model: string | null;
  count: number;
  palletCode: string | null;
  stockEntered: boolean;
}

export interface StockPalletRow {
  id: string;
  code: string | null;
  cartonCount: number;
  productCount: number;
  stockEntered: boolean;
  cartons: StockCartonRow[];
}

export interface StockInventory {
  cartons: StockCartonRow[];
  pallets: StockPalletRow[];
}

/**
 * End-of-line inventory for the admin: every produced (closed) carton and every
 * pallet, with their stock status. Item serials are loaded lazily per carton
 * (via getCartonLabel) when a row is expanded.
 */
export async function getStockInventory(): Promise<StockInventory> {
  const supabase = await createClient();
  const [cartonsRes, palletsRes] = await Promise.all([
    supabase
      .from("pipeline_cartons")
      .select("id, code, model, count, pallet_id, stock_entered, closed_at")
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(1000),
    supabase
      .from("pipeline_pallets")
      .select("id, code, count, stock_entered, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  type CartonDb = {
    id: string;
    code: string | null;
    model: string | null;
    count: number;
    pallet_id: string | null;
    stock_entered: boolean;
  };
  const cartonRows = (cartonsRes.data as CartonDb[]) ?? [];
  const palletRows =
    (palletsRes.data as { id: string; code: string | null; count: number; stock_entered: boolean }[]) ?? [];

  const palletCodeById = new Map(palletRows.map((p) => [p.id, p.code]));

  const toRow = (c: CartonDb): StockCartonRow => ({
    id: c.id,
    code: c.code,
    model: c.model,
    count: c.count,
    palletCode: c.pallet_id ? (palletCodeById.get(c.pallet_id) ?? null) : null,
    stockEntered: c.stock_entered,
  });

  const cartons = cartonRows.map(toRow);

  const byPallet = new Map<string, StockCartonRow[]>();
  cartonRows.forEach((c, i) => {
    if (!c.pallet_id) return;
    const arr = byPallet.get(c.pallet_id) ?? [];
    arr.push(cartons[i]);
    byPallet.set(c.pallet_id, arr);
  });

  const pallets: StockPalletRow[] = palletRows.map((p) => {
    const its = byPallet.get(p.id) ?? [];
    return {
      id: p.id,
      code: p.code,
      cartonCount: its.length,
      productCount: its.reduce((n, c) => n + c.count, 0),
      stockEntered: p.stock_entered,
      cartons: its,
    };
  });

  return { cartons, pallets };
}

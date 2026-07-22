"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { usePagedList } from "@/lib/ui/use-paged-list";
import { getCartonLabel, getPalletLabel, type PalletLabelData } from "@/app/(app)/scan/carton-actions";
import { PalletLabel } from "@/components/scan/PalletLabel";
import type { StockInventory, StockCartonRow, StockPalletRow } from "@/lib/admin/stock";
import { cn } from "@/lib/cn";
import { ChevronRight, Package, Layers, Warehouse, Boxes, Printer } from "lucide-react";

type View = "cartons" | "pallets";

function StatusBadge({ inStock }: { inStock: boolean }) {
  const t = useT();
  return <Badge tone={inStock ? "success" : "warning"}>{t(inStock ? "adminStock.inStock" : "adminStock.awaiting")}</Badge>;
}

/** A carton row that lazily loads and shows its item serials when expanded. */
function CartonRow({ carton, nested }: { carton: StockCartonRow; nested?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null && !loading) {
      setLoading(true);
      try {
        const label = await getCartonLabel(carton.id);
        setItems(label?.serials ?? []);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <li className={cn("rounded-2xl border border-[var(--border)]", nested ? "bg-[var(--surface)]" : "bg-[var(--surface-2)]")}>
      <button onClick={toggle} className="ring-accent flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start hover:bg-[var(--surface)]">
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-90")} />
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Package className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm text-foreground">{carton.code ?? "—"}</div>
          <div className="truncate text-xs text-faint">
            {carton.model ?? "—"}
            {carton.palletCode ? ` · ${carton.palletCode}` : ""}
          </div>
        </div>
        <Badge tone="neutral">
          {carton.count} {t("adminStock.items")}
        </Badge>
        <StatusBadge inStock={carton.stockEntered} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {loading ? (
            <div className="text-xs text-faint">…</div>
          ) : items && items.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {items.map((s) => (
                <span key={s} className="rounded-lg bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-foreground">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-faint">{t("adminStock.noItems")}</div>
          )}
        </div>
      )}
    </li>
  );
}

/** A pallet row that expands to its cartons (each of which expands to items). */
function PalletRow({ pallet, onPrint }: { pallet: StockPalletRow; onPrint: (id: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex items-center gap-1 pe-2">
        <button onClick={() => setOpen((o) => !o)} className="ring-accent flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-start hover:bg-[var(--surface)]">
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-90")} />
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm text-foreground">{pallet.code ?? "—"}</div>
            <div className="truncate text-xs text-faint">
              {pallet.cartonCount} {t("adminStock.cartons")} · {pallet.productCount} {t("adminStock.items")}
            </div>
          </div>
          <StatusBadge inStock={pallet.stockEntered} />
        </button>
        {pallet.code && (
          <button
            onClick={() => onPrint(pallet.id)}
            title={t("reprint.print")}
            className="ring-accent grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:text-[var(--accent)]"
          >
            <Printer className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-[var(--border)] p-3">
          {pallet.cartons.length === 0 ? (
            <div className="py-2 text-center text-xs text-faint">{t("adminStock.noCartons")}</div>
          ) : (
            <ul className="space-y-2">
              {pallet.cartons.map((c) => (
                <CartonRow key={c.id} carton={c} nested />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function AdminStock({ inventory }: { inventory: StockInventory }) {
  const t = useT();
  const [view, setView] = useState<View>("cartons");
  const [labelPallet, setLabelPallet] = useState<PalletLabelData | null>(null);
  const { cartons, pallets } = inventory;

  async function printPallet(id: string) {
    try {
      const label = await getPalletLabel(id);
      if (label) setLabelPallet(label);
    } catch {
      /* ignore */
    }
  }

  const cartonList = usePagedList(cartons, (c) => `${c.code ?? ""} ${c.model ?? ""} ${c.palletCode ?? ""}`);
  const palletList = usePagedList(pallets, (p) => p.code ?? "");
  const active = view === "cartons" ? cartonList : palletList;

  return (
    <>
      {/* Only the pallet label prints (the app UI is hidden). */}
      <style>{`@media print { @page { margin: 8mm; } body * { visibility: hidden !important; } #print-label, #print-label * { visibility: visible !important; } #print-label { position: fixed !important; top: 0; left: 0; right: 0; margin: 0 auto !important; width: 100% !important; max-width: 720px !important; } #print-label svg { max-width: 100% !important; height: auto !important; } }`}</style>

      <PageHeader title={t("adminStock.title")} subtitle={t("adminStock.subtitle")}>
        <Badge tone="accent" dot>
          <Warehouse className="me-1 h-3.5 w-3.5" />
          {cartons.length} {t("adminStock.cartons")}
        </Badge>
      </PageHeader>

      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl<View>
            value={view}
            onChange={setView}
            segments={[
              { value: "cartons", label: t("adminStock.byCarton"), icon: <Package className="h-4 w-4" /> },
              { value: "pallets", label: t("adminStock.byPallet"), icon: <Layers className="h-4 w-4" /> },
            ]}
          />
          <SearchInput value={active.query} onChange={active.setQuery} />
        </div>

        {view === "cartons" ? (
          cartonList.total === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-faint">
              <Boxes className="mx-auto mb-2 h-6 w-6 opacity-60" />
              {cartons.length === 0 ? t("adminStock.noCartons") : t("common.noResults")}
            </div>
          ) : (
            <ul className="space-y-2">
              {cartonList.pageItems.map((c) => (
                <CartonRow key={c.id} carton={c} />
              ))}
            </ul>
          )
        ) : palletList.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-faint">
            <Layers className="mx-auto mb-2 h-6 w-6 opacity-60" />
            {pallets.length === 0 ? t("adminStock.noPallets") : t("common.noResults")}
          </div>
        ) : (
          <ul className="space-y-2">
            {palletList.pageItems.map((p) => (
              <PalletRow key={p.id} pallet={p} onPrint={printPallet} />
            ))}
          </ul>
        )}

        <Pagination
          page={active.page}
          pageCount={active.pageCount}
          from={active.from}
          to={active.to}
          total={active.total}
          onPage={active.setPage}
        />
      </GlassCard>

      {/* Printable pallet label — pallet QR + a grid of its carton barcodes. */}
      <Modal open={!!labelPallet} onClose={() => setLabelPallet(null)} title={t("track.pallet")}>
        {labelPallet && (
          <div className="flex flex-col gap-4">
            <PalletLabel label={labelPallet} />
            <div className="flex gap-2">
              <Button variant="glass" onClick={() => window.print()} className="flex-1">
                <Printer className="h-4 w-4" /> {t("reprint.print")}
              </Button>
              <Button onClick={() => setLabelPallet(null)} className="flex-1">
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

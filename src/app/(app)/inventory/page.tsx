"use client";

import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { products, type StockState } from "@/lib/mock-data";
import { Plus, Package } from "lucide-react";

const STATE_TONE: Record<StockState, Tone> = {
  inStock: "success",
  low: "warning",
  out: "danger",
};

export default function InventoryPage() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("inventory.title")} subtitle={t("inventory.subtitle")}>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("common.add")}
        </Button>
      </PageHeader>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p, i) => (
          <GlassCard key={p.sku} interactive padded={false} style={{ ["--i" as string]: i }} className="overflow-hidden">
            {/* thumbnail */}
            <div
              className="relative grid h-32 place-items-center"
              style={{ background: `hsl(${p.hue} 55% 55%)` }}
            >
              <Package className="h-10 w-10 text-white/80" />
              <span className="absolute end-3 top-3">
                <Badge tone={STATE_TONE[p.state]} dot>
                  {t(`inventory.${p.state}` as DictKey)}
                </Badge>
              </span>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-faint">
                    {t("inventory.sku")} {p.sku} · {p.category}
                  </div>
                </div>
                <div className="font-display font-semibold text-foreground">{p.price}</div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-faint">{p.stock} {t("inventory.units")}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(p.stock / 2.5, 100)}%`,
                      background:
                        p.state === "out"
                          ? "var(--border)"
                          : p.state === "low"
                            ? "#f59e0b"
                            : "var(--accent)",
                    }}
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}

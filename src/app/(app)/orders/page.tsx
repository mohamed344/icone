"use client";

import { useState } from "react";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { orders, type OrderStatus } from "@/lib/mock-data";
import { Plus, Search, MoreHorizontal } from "lucide-react";

const STATUS_TONE: Record<OrderStatus, Tone> = {
  paid: "success",
  pending: "warning",
  shipped: "info",
  refunded: "danger",
};

export default function OrdersPage() {
  const t = useT();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (o.customer.toLowerCase().includes(query.toLowerCase()) ||
        o.id.toLowerCase().includes(query.toLowerCase())),
  );

  const segs = [
    { value: "all" as const, label: t("common.all") },
    { value: "paid" as const, label: t("orders.paid") },
    { value: "pending" as const, label: t("orders.pending") },
    { value: "shipped" as const, label: t("orders.shipped") },
    { value: "refunded" as const, label: t("orders.refunded") },
  ];

  return (
    <>
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("common.new")}
        </Button>
      </PageHeader>

      <GlassCard padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <SegmentedControl size="sm" value={filter} onChange={setFilter} segments={segs} />
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              className="ring-accent h-10 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] ps-9 pe-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-y border-[var(--border)] text-start text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 text-start font-medium">{t("orders.id")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("orders.customer")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("orders.date")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("common.status")}</th>
                <th className="px-5 py-3 text-end font-medium">{t("orders.total")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-5 py-3 font-mono text-xs font-medium text-[var(--accent)]">{o.id}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={o.customer.split(" ").map((w) => w[0]).join("")} size="sm" hue={(o.id.length * 47) % 360} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{o.customer}</div>
                        <div className="truncate text-xs text-faint">{o.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">{o.date}</td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[o.status]} dot>
                      {t(`orders.${o.status}` as DictKey)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-end font-semibold text-foreground">{o.total}</td>
                  <td className="px-5 py-3 text-end">
                    <button className="ring-accent grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-faint">
                    {t("common.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </>
  );
}

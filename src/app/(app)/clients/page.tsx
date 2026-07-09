"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { clients } from "@/lib/mock-data";
import { Plus, MessageCircle, ShoppingBag, CalendarDays } from "lucide-react";

export default function ClientsPage() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("clients.title")} subtitle={t("clients.subtitle")}>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("common.add")}
        </Button>
      </PageHeader>

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clients.map((c, i) => (
          <GlassCard key={c.name} interactive style={{ ["--i" as string]: i }} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar initials={c.initials} hue={c.hue} size="lg" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">{c.name}</div>
                <div className="truncate text-xs text-faint">{c.company}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-[var(--surface-2)] p-3">
                <div className="text-xs text-faint">{t("clients.spend")}</div>
                <div className="mt-0.5 font-display font-semibold text-foreground">{c.spend}</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-1 text-xs text-faint">
                  <ShoppingBag className="h-3 w-3" />
                  {t("dash.orders")}
                </div>
                <div className="mt-0.5 font-display font-semibold text-foreground">{c.orders}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-faint">
                <CalendarDays className="h-3.5 w-3.5" />
                {t("clients.since")} {c.since}
              </span>
              <Button variant="ghost" size="sm">
                <MessageCircle className="h-4 w-4" />
                {t("clients.message")}
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}

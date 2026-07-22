"use client";

import { useState } from "react";
import Barcode from "react-barcode";
import { inspectCode, type InspectResult, type InspectCarton, type CarteMember } from "@/app/(app)/scan/inspect-actions";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "./ToolScanField";
import { Boxes, Package, Layers, ScanSearch, AlertCircle, Cpu, Link2 } from "lucide-react";

/** A single Code128 barcode on a white tile (readable on the dark UI). */
function Bars({ value, small = false }: { value: string; small?: boolean }) {
  return (
    <div className="flex w-full justify-center overflow-hidden rounded-lg bg-white p-1.5 [&_svg]:h-auto [&_svg]:max-w-full">
      <Barcode value={value} format="CODE128" height={small ? 26 : 34} width={1} fontSize={11} margin={2} />
    </div>
  );
}

/** The cartes inside a carton: each carte's serial + its dimo barcode. */
function CarteMembers({ members }: { members: CarteMember[] }) {
  const t = useT();
  if (members.length === 0) return <div className="py-3 text-center text-xs text-faint">{t("track.empty")}</div>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {members.map((m) => (
        <div key={m.serial} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
            <Cpu className="h-3.5 w-3.5" />
            <span className="truncate font-mono text-foreground">{m.serial}</span>
          </div>
          {m.dimo ? (
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-faint">
                <Link2 className="h-3 w-3" /> {t("track.dimos")}
              </div>
              <Bars value={m.dimo} small />
            </div>
          ) : (
            <Bars value={m.serial} small />
          )}
        </div>
      ))}
    </div>
  );
}

/** A carton block: its own code barcode + its cartes (used inside pallet view). */
function CartonBlock({ carton }: { carton: InspectCarton }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Package className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm text-foreground">{carton.code ?? `#${carton.cartonNumber}`}</div>
          <div className="truncate text-xs text-faint">
            {carton.count} · {carton.model ?? "—"}
          </div>
        </div>
      </div>
      {carton.code && (
        <div className="mb-2.5 max-w-xs">
          <Bars value={carton.code} small />
        </div>
      )}
      <CarteMembers members={carton.members} />
    </div>
  );
}

function ResultHeader({ icon, title, subtitle, count }: { icon: React.ReactNode; title: string; subtitle: string; count: number }) {
  const t = useT();
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">{icon}</span>
      <div className="flex-1">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-faint">{subtitle}</p>
      </div>
      <Badge tone="accent" dot>
        {t("track.count").replace("{n}", String(count))}
      </Badge>
    </div>
  );
}

export function TrackConsole() {
  const t = useT();
  const [result, setResult] = useState<InspectResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function scan(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setBusy(true);
    setNotFound(false);
    try {
      const r = await inspectCode(code);
      if (r.kind === "none") {
        setResult(null);
        setNotFound(true);
      } else {
        setResult(r);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("track.title")} subtitle={t("track.subtitle")} />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanSearch className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("track.title")}</h2>
              <p className="text-xs text-faint">{t("track.scanHint")}</p>
            </div>
          </div>
          <ToolScanField onScan={scan} busy={busy} placeholder={t("track.scanHint")} />
          {notFound && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("track.notFound")}</span>
            </div>
          )}
        </GlassCard>

        {/* Box → carte barcodes */}
        {result?.kind === "box" && (
          <GlassCard>
            <ResultHeader
              icon={<Boxes className="h-5 w-5" />}
              title={`${t("track.box")} #${result.boxNumber}`}
              subtitle={result.product ?? result.code}
              count={result.members.length}
            />
            {result.members.length === 0 ? (
              <div className="py-8 text-center text-sm text-faint">{t("track.empty")}</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.members.map((s) => (
                  <div key={s} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
                    <Bars value={s} small />
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {/* Carton → cartes (serial + dimo barcode) */}
        {result?.kind === "carton" && (
          <GlassCard>
            <ResultHeader
              icon={<Package className="h-5 w-5" />}
              title={`${t("track.carton")} #${result.carton.cartonNumber}`}
              subtitle={result.carton.code ?? result.carton.model ?? "—"}
              count={result.carton.members.length}
            />
            <CarteMembers members={result.carton.members} />
          </GlassCard>
        )}

        {/* Pallet → cartons → cartes */}
        {result?.kind === "pallet" && (
          <GlassCard>
            <ResultHeader
              icon={<Layers className="h-5 w-5" />}
              title={`${t("track.pallet")} #${result.palletNumber}`}
              subtitle={result.code}
              count={result.cartons.length}
            />
            {result.cartons.length === 0 ? (
              <div className="py-8 text-center text-sm text-faint">{t("track.empty")}</div>
            ) : (
              <div className="space-y-3">
                {result.cartons.map((c) => (
                  <CartonBlock key={c.id} carton={c} />
                ))}
              </div>
            )}
          </GlassCard>
        )}
      </div>
    </>
  );
}

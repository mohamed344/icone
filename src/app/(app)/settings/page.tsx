"use client";

import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/theme-context";
import {
  ACCENT_PRESETS,
  BACKGROUND_PRESETS,
  FONTS,
  ENABLED_LANGUAGES,
  LANGUAGE_LABELS,
  type Mode,
  type Density,
  type FontKey,
  type Language,
  type UiStyle,
} from "@/lib/theme/theme-config";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ColorSwatch } from "@/components/ui/ColorSwatch";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/lib/cn";
import {
  Palette,
  PaintBucket,
  Type,
  Languages,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Check,
  Rows3,
  Rows4,
  DollarSign,
  Sparkles,
  Square,
} from "lucide-react";

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
          {hint && <p className="text-xs text-faint">{hint}</p>}
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

export default function SettingsPage() {
  const t = useT();
  const { theme, setTheme, reset } = useTheme();

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")}>
        <Button variant="glass" size="sm" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          {t("settings.reset")}
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Controls */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Section icon={<Palette className="h-5 w-5" />} title={t("settings.accent")} hint={t("settings.accentHint")}>
            <div className="flex flex-wrap gap-3">
              {ACCENT_PRESETS.map((a) => (
                <ColorSwatch
                  key={a.key}
                  color={a.accent}
                  name={a.name}
                  selected={theme.accent === a.key}
                  onClick={() => setTheme({ accent: a.key })}
                />
              ))}
            </div>
          </Section>

          <Section icon={<PaintBucket className="h-5 w-5" />} title={t("settings.background")} hint={t("settings.backgroundHint")}>
            <div className="flex flex-wrap gap-3">
              {BACKGROUND_PRESETS.map((b) => (
                <ColorSwatch
                  key={b.key}
                  color={b.bg}
                  name={b.name}
                  selected={theme.background === b.key}
                  onClick={() => setTheme({ background: b.key })}
                />
              ))}
            </div>
          </Section>

          <Section icon={<Sparkles className="h-5 w-5" />} title={t("settings.style")} hint={t("settings.styleHint")}>
            <SegmentedControl<UiStyle>
              value={theme.style}
              onChange={(v) => setTheme({ style: v })}
              segments={[
                { value: "flat", label: t("settings.flat"), icon: <Square className="h-4 w-4" /> },
                { value: "gradient", label: t("settings.gradient"), icon: <Sparkles className="h-4 w-4" /> },
              ]}
            />
          </Section>

          <Section icon={<Sun className="h-5 w-5" />} title={t("settings.mode")} hint={t("settings.modeHint")}>
            <SegmentedControl<Mode>
              value={theme.mode}
              onChange={(v) => setTheme({ mode: v })}
              segments={[
                { value: "light", label: t("settings.light"), icon: <Sun className="h-4 w-4" /> },
                { value: "dark", label: t("settings.dark"), icon: <Moon className="h-4 w-4" /> },
                { value: "system", label: t("settings.system"), icon: <Monitor className="h-4 w-4" /> },
              ]}
            />
          </Section>

          <Section icon={<Type className="h-5 w-5" />} title={t("settings.typography")}>
            <div>
              <div className="mb-2 text-sm font-medium text-muted">{t("settings.font")}</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {FONTS.map((f) => {
                  const active = theme.font === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setTheme({ font: f.key as FontKey })}
                      className={cn(
                        "ring-accent relative rounded-2xl border p-4 text-start transition-all",
                        active
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--accent)]",
                      )}
                    >
                      {active && (
                        <Check className="absolute end-3 top-3 h-4 w-4 text-[var(--accent)]" strokeWidth={3} />
                      )}
                      <div className={cn("text-2xl font-semibold text-foreground", f.previewClass)}>Ag</div>
                      <div className="mt-1 text-xs text-faint">{f.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-muted">{t("settings.density")}</div>
              <SegmentedControl<Density>
                value={theme.density}
                onChange={(v) => setTheme({ density: v })}
                segments={[
                  { value: "comfortable", label: t("settings.comfortable"), icon: <Rows3 className="h-4 w-4" /> },
                  { value: "compact", label: t("settings.compact"), icon: <Rows4 className="h-4 w-4" /> },
                ]}
              />
              <p className="mt-2 text-xs text-faint">{t("settings.densityHint")}</p>
            </div>
          </Section>

          <Section icon={<Languages className="h-5 w-5" />} title={t("settings.language")} hint={t("settings.languageHint")}>
            <SegmentedControl<Language>
              value={theme.language}
              onChange={(v) => setTheme({ language: v })}
              segments={ENABLED_LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }))}
            />
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-[5.5rem]">
            <GlassCard className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted">{t("settings.preview")}</span>
                <Badge tone="accent" dot>
                  {t("common.saved")}
                </Badge>
              </div>

              <StatCard
                label={t("dash.revenue")}
                value="$48,210"
                delta="+12.4%"
                trend="up"
                spark={[12, 18, 14, 22, 26, 24, 31, 29, 36]}
                icon={<DollarSign className="h-4 w-4" />}
              />

              <div className="flex flex-wrap gap-2">
                <Button size="sm">{t("common.save")}</Button>
                <Button variant="glass" size="sm">
                  {t("common.cancel")}
                </Button>
                <Button variant="outline" size="sm">
                  {t("common.new")}
                </Button>
              </div>

              <div className="rounded-2xl bg-[var(--surface-2)] p-4">
                <div className="text-gradient font-display text-xl font-semibold">
                  {t("app.name")}
                </div>
                <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone="success" dot>{t("orders.paid")}</Badge>
                <Badge tone="warning" dot>{t("orders.pending")}</Badge>
                <Badge tone="danger" dot>{t("orders.refunded")}</Badge>
                <Badge tone="info" dot>{t("orders.shipped")}</Badge>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </>
  );
}

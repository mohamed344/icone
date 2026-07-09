"use client";

import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type Tone } from "@/components/ui/Badge";
import { team, type Presence } from "@/lib/mock-data";
import { UserPlus, Mail, MoreHorizontal } from "lucide-react";

const PRESENCE_TONE: Record<Presence, Tone> = {
  online: "success",
  away: "warning",
  offline: "neutral",
};

export default function TeamPage() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")}>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          {t("team.invite")}
        </Button>
      </PageHeader>

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {team.map((m, i) => (
          <GlassCard key={m.email} interactive style={{ ["--i" as string]: i }} className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar initials={m.initials} hue={m.hue} size="lg" presence={m.presence} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{m.name}</div>
                  <div className="truncate text-xs text-faint">{m.role}</div>
                </div>
              </div>
              <button className="ring-accent grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <Badge tone={PRESENCE_TONE[m.presence]} dot>
                {t(`team.${m.presence}` as DictKey)}
              </Badge>
              <a
                href={`mailto:${m.email}`}
                className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-[var(--accent)]"
              >
                <Mail className="h-3.5 w-3.5" />
                {m.email}
              </a>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}

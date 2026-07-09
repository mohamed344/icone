"use client";

import Image from "next/image";
import { useT } from "@/lib/i18n";
import { ShieldCheck, Zap, Globe } from "lucide-react";

export function AuthBrandPanel() {
  const t = useT();
  const points = [
    { icon: Zap, text: "Real-time ops, zero noise" },
    { icon: ShieldCheck, text: "Private by default — your data stays yours" },
    { icon: Globe, text: "Works in your language, right-to-left included" },
  ];
  return (
    <div className="relative hidden overflow-hidden border-e border-[var(--border)] bg-[var(--bg-2)] lg:flex">
      <div className="relative z-10 flex w-full flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Image src="/icone-mark.png" alt={t("app.name")} width={44} height={44} priority className="h-11 w-11 object-contain" />
          <span className="font-display text-xl font-semibold text-foreground">
            {t("app.name")}
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-foreground">
            {t("auth.brandLine")}
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map((p, i) => {
              const Icon = p.icon;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl glass-2 text-[var(--accent)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-muted">{p.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="glass-card max-w-md p-5">
          <p className="text-sm leading-relaxed text-muted">
            “We replaced four spreadsheets and two apps with this. The team actually
            enjoys checking it now.”
          </p>
          <div className="mt-3 text-xs font-medium text-foreground">
            Marcus Bell · Oakline
          </div>
        </div>
      </div>
    </div>
  );
}

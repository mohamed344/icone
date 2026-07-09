"use client";

import { useRef } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Keyboard, Loader2 } from "lucide-react";

/**
 * Physical-scanner input: a debounced textarea that finalizes ~90ms after the
 * tool goes idle (handles multi-keystroke scans), clears + refocuses after each.
 */
export function ToolScanField({
  onScan,
  busy = false,
  placeholder,
}: {
  onScan: (code: string) => void;
  busy?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  function finalize() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const el = taRef.current;
    const raw = el?.value ?? "";
    if (el) el.value = "";
    onScan(raw);
    el?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      timerRef.current = window.setTimeout(finalize, 90);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="relative flex-1">
        <Keyboard className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-faint" />
        <textarea
          ref={taRef}
          rows={1}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t("scan.scanHere")}
          autoFocus
          spellCheck={false}
          className="ring-accent min-h-[2.75rem] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 ps-10 pe-4 font-mono text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
        />
      </div>
      <Button onClick={finalize} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("scan.record")}
      </Button>
    </div>
  );
}

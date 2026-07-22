"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Keyboard, Loader2 } from "lucide-react";

/**
 * Physical-scanner input: a textarea that AUTO-SUBMITS each scan — no button.
 * It finalizes the moment the scanner sends Enter, or ~200ms after the scan
 * burst goes idle (so guns with no Enter suffix still submit on their own).
 * Clears + refocuses after each scan. `autoFocus` grabs focus when it becomes
 * the active field; `disabled` greys it out while it's not the operator's turn.
 */
export function ToolScanField({
  onScan,
  busy = false,
  placeholder,
  autoFocus = true,
  disabled = false,
}: {
  onScan: (code: string) => void;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Focus when this field becomes the active one (autoFocus true & enabled).
  useEffect(() => {
    if (autoFocus && !disabled) taRef.current?.focus();
  }, [autoFocus, disabled]);

  // Cancel any pending finalize on unmount.
  useEffect(() => () => clearTimer(), []);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function finalize() {
    clearTimer();
    const el = taRef.current;
    const raw = el?.value ?? "";
    if (el) el.value = "";
    if (raw.trim()) onScan(raw);
    el?.focus();
  }

  function scheduleFinalize(delay: number) {
    clearTimer();
    timerRef.current = window.setTimeout(finalize, delay);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // The scanner's Enter terminator → submit right away.
    if (e.key === "Enter") {
      e.preventDefault();
      scheduleFinalize(60);
    }
  }

  // Auto-submit shortly after the scan characters stop arriving (no Enter needed).
  function onChange() {
    scheduleFinalize(200);
  }

  return (
    <div className="relative">
      <Keyboard className="pointer-events-none absolute start-5 top-1/2 h-6 w-6 -translate-y-1/2 text-faint" />
      <textarea
        ref={taRef}
        rows={1}
        wrap="off"
        onKeyDown={onKeyDown}
        onChange={onChange}
        placeholder={placeholder ?? t("scan.scanHere")}
        disabled={disabled}
        spellCheck={false}
        className={cn(
          "ring-accent h-20 w-full resize-none overflow-hidden truncate rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-6 ps-14 pe-14 font-mono text-xl text-foreground placeholder:text-faint focus:border-[var(--accent)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      />
      {busy && (
        <Loader2 className="absolute end-5 top-1/2 h-6 w-6 -translate-y-1/2 animate-spin text-[var(--accent)]" />
      )}
    </div>
  );
}

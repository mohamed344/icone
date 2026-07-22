"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "icone.autoPrint";

/**
 * Per-device "auto-print" preference (persisted in localStorage, so each
 * physical station decides independently). When on, label scanners fire
 * `window.print()` automatically as soon as a label appears — no button click.
 */
export function useAutoPrint() {
  const [autoPrint, setState] = useState(false);

  // Hydrate from localStorage on mount (client-only; SSR renders "off").
  useEffect(() => {
    try {
      setState(localStorage.getItem(KEY) === "1");
    } catch {
      /* ignore (private mode / disabled storage) */
    }
  }, []);

  const setAutoPrint = useCallback((v: boolean) => {
    setState(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return { autoPrint, setAutoPrint };
}

/**
 * Fire the browser print dialog once, after a short delay so the label's
 * barcode/QR SVG has finished rendering in the just-opened modal.
 */
export function printSoon(delayMs = 300): () => void {
  const id = window.setTimeout(() => window.print(), delayMs);
  return () => window.clearTimeout(id);
}

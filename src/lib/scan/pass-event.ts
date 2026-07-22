"use client";

/**
 * Client-only signal fired the moment a scanner successfully passes a code to
 * the next step. The supervisor's "waiting per step" panel listens for it and
 * refreshes immediately, so its counts move without a manual page refresh.
 */
export const SCAN_PASSED_EVENT = "icone:scan-passed";

/** Emit the pass signal (no-op during SSR). */
export function emitScanPassed() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCAN_PASSED_EVENT));
}

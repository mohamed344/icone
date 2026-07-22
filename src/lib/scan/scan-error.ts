import type { DictKey } from "@/lib/i18n";

/** The sequence-gate fields returned by recordScan / recordOtpScan. */
export interface SeqScanError {
  reason?: "out_of_order" | "step_off" | "completed" | (string & {});
  expectedStage?: string | null;
  /** True when the code has never been scanned anywhere yet. */
  notStarted?: boolean;
  error?: string | null;
}

/**
 * Friendly, localized message for a failed sequential scan. Distinguishes a
 * code that was never scanned in (→ start it at the first step, Scan PCBA) from
 * one scanned too far ahead (→ pass it through the step it's stuck at first).
 * Falls back to the raw server `error` for anything that isn't a sequence gate.
 */
export function seqScanErrorMessage(t: (key: DictKey) => string, res: SeqScanError): string {
  const stage = res.expectedStage ? t(`stage.${res.expectedStage}` as DictKey) : "";
  switch (res.reason) {
    case "out_of_order":
      return (res.notStarted ? t("scan.notStarted") : t("scan.outOfOrder")).replace(
        /\{stage\}/g,
        stage,
      );
    case "step_off":
      return t("scan.stepOff");
    case "completed":
      return t("scan.completed");
    default:
      return res.error ?? "";
  }
}

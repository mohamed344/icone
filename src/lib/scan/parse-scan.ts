/**
 * Parse a value coming from the physical scanner tool.
 *
 * At Scan PCBA a carte mère carries two marks:
 *  - a QR code whose text holds the unit data as "Label: value" lines
 *  - a barcode that is a plain serial (e.g. Icone20260104027129)
 *
 * The scan field auto-detects which one was scanned.
 */

export interface ScanField {
  label: string;
  value: string;
}

export interface ParsedScan {
  kind: "qr" | "barcode";
  /** Trimmed raw value (for a barcode this is the serial). */
  code: string;
  /** Present when kind === "qr". */
  fields?: ScanField[];
  /** Best-effort operator/employee name pulled from the QR (kind === "qr"). */
  operator?: string;
}

/** True when the text looks like structured QR data, not a single serial. */
function looksLikeQr(text: string): boolean {
  if (/[\r\n]/.test(text)) return true; // multi-line → QR
  if (/[A-Za-z0-9 ]+:\s*\S/.test(text)) return true; // has a "Label: value" pair
  return false;
}

/** Split QR text into "Label: value" pairs. */
function parseFields(text: string): ScanField[] {
  const segments = /[\r\n]/.test(text)
    ? text.split(/\r?\n/)
    : text.split(/[;|]/); // single-line fallback separators

  const fields: ScanField[] = [];
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    const idx = s.indexOf(":");
    if (idx === -1) {
      fields.push({ label: "", value: s });
    } else {
      fields.push({ label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() });
    }
  }
  return fields;
}

/**
 * @param raw     the scanned text
 * @param enableQr  enable QR detection (Scan PCBA only). When false, everything
 *                  is treated as a barcode that advances the workflow.
 */
export function parseScan(raw: string, enableQr: boolean): ParsedScan {
  const trimmed = raw.trim();

  if (enableQr && looksLikeQr(trimmed)) {
    const fields = parseFields(trimmed);
    // The N° série is the identifier that flows on to OTP, so extract it robustly:
    //  1) a field labelled like serial/série/code/sn/matricule/pcba;
    //  2) otherwise a value that looks like a serial (letters then ≥5 digits,
    //     e.g. "Icone2026010402760").
    const serial =
      fields.find((f) => /serial|s[ée]rie|\bsn\b|matricule|pcba|code/i.test(f.label))?.value ??
      fields.find((f) => /^[a-z]{2,}\d{5,}$/i.test((f.value ?? "").replace(/\s+/g, "")))?.value;
    // Best-effort operator/employee name (a field named like operator/employé/agent).
    const operator = fields.find((f) =>
      /op[ée]rateur|operator|employ|agent|ouvrier|worker|technicien|nom|name/i.test(f.label),
    )?.value;
    return { kind: "qr", code: serial ?? trimmed, fields, operator };
  }

  // Barcode: collapse any stray whitespace/newlines to a single token.
  return { kind: "barcode", code: trimmed.replace(/\s+/g, "") };
}

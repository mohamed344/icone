/**
 * Parse a value coming from the physical scanner tool.
 *
 * At Scan BF a carte mère carries two marks:
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
 * @param enableQr  enable QR detection (Scan BF only). When false, everything
 *                  is treated as a barcode that advances the workflow.
 */
export function parseScan(raw: string, enableQr: boolean): ParsedScan {
  const trimmed = raw.trim();

  if (enableQr && looksLikeQr(trimmed)) {
    const fields = parseFields(trimmed);
    // Best-effort serial for reference (a field named like serial/série/code).
    const serial = fields.find((f) => /serial|s[ée]rie|code|sn/i.test(f.label))?.value;
    return { kind: "qr", code: serial ?? trimmed, fields };
  }

  // Barcode: collapse any stray whitespace/newlines to a single token.
  return { kind: "barcode", code: trimmed.replace(/\s+/g, "") };
}

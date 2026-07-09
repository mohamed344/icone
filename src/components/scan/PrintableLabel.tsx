"use client";

import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import type { UnitLabel } from "@/app/(app)/scan/unit-actions";

/**
 * A printable product label: the serial as a Code128 barcode + a QR of the
 * serial, plus product / box text. Only this block is shown when printing
 * (see the print CSS injected by ReprintScanner).
 */
export function PrintableLabel({ label }: { label: UnitLabel }) {
  return (
    <div id="print-label" className="mx-auto w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center text-black">
      {label.product && <div className="text-lg font-bold uppercase tracking-wide">{label.product}</div>}
      <div className="mt-3 flex items-center justify-center gap-4">
        <QRCodeSVG value={label.serial} size={96} level="M" />
      </div>
      <div className="mt-3 flex justify-center">
        <Barcode value={label.serial} format="CODE128" height={56} width={1.6} fontSize={13} margin={0} />
      </div>
      {label.boxCode && <div className="mt-2 font-mono text-xs text-neutral-500">{label.boxCode}</div>}
    </div>
  );
}

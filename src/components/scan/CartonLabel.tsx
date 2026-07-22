"use client";

import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import type { CartonLabelData } from "@/app/(app)/scan/carton-actions";

/**
 * A compact, professional carton label: a clean header (model + QR of the
 * carton code + carton number) and a tight grid of every carte's Code128
 * barcode with its serial. Only this block prints (see the print CSS in
 * CartonScanner).
 */
export function CartonLabel({ label }: { label: CartonLabelData }) {
  const { serials, model, code, cartonNumber } = label;
  return (
    <div
      id="print-label"
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-300 bg-white p-4 text-black [break-inside:avoid]"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-neutral-200 pb-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold uppercase leading-tight tracking-wide">{model || "—"}</div>
          <div className="mt-0.5 font-mono text-[10px] text-neutral-500">{code}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right leading-none">
            <div className="text-[9px] uppercase tracking-widest text-neutral-400">N°</div>
            <div className="text-2xl font-bold">{cartonNumber}</div>
          </div>
          <QRCodeSVG value={code ?? String(cartonNumber)} size={64} level="M" />
        </div>
      </div>

      {/* Barcode grid — 4 tight columns */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
        {serials.map((s) => (
          <div key={s} className="flex flex-col items-center overflow-hidden">
            <div className="flex w-full justify-center overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full">
              <Barcode value={s} format="CODE128" height={22} width={1} displayValue={false} margin={0} />
            </div>
            <div className="mt-px font-mono text-[7px] leading-none text-neutral-700">{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

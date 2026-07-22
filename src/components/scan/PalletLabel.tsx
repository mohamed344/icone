"use client";

import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import type { PalletLabelData } from "@/app/(app)/scan/carton-actions";

/**
 * A printable pallet label: the pallet code as a QR + Code128 barcode, plus a
 * grid of every member carton's code as a barcode — so a pallet's contents are
 * trackable and each carton can be re-scanned. Only this block prints (see the
 * print CSS injected by the printing screen).
 */
export function PalletLabel({ label }: { label: PalletLabelData }) {
  const { code, palletNumber, cartonCodes } = label;
  return (
    <div
      id="print-label"
      className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-300 bg-white p-4 text-black [break-inside:avoid]"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-4 border-b border-neutral-200 pb-3">
        <div className="min-w-0">
          <div className="text-xl font-bold uppercase leading-tight tracking-wide">Palette</div>
          <div className="mt-0.5 font-mono text-[10px] text-neutral-500">{code}</div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right leading-none">
            <div className="text-[9px] uppercase tracking-widest text-neutral-400">N°</div>
            <div className="text-2xl font-bold">{palletNumber}</div>
          </div>
          <QRCodeSVG value={code ?? String(palletNumber)} size={64} level="M" />
        </div>
      </div>

      {/* Carton codes grid */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        {cartonCodes.map((c) => (
          <div key={c} className="flex flex-col items-center overflow-hidden">
            <div className="flex w-full justify-center overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full">
              <Barcode value={c} format="CODE128" height={22} width={1} displayValue={false} margin={0} />
            </div>
            <div className="mt-px font-mono text-[7px] leading-none text-neutral-700">{c}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

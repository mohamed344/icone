"use client";

import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import { useT } from "@/lib/i18n";

/**
 * A printable box label: the box code as a Code128 barcode + a QR of the same
 * code, plus a grid of every member carte's barcode so the box's contents can be
 * tracked at a glance (and re-scanned). Only this block prints (see the print CSS
 * injected by OtpScanner).
 */
export function BoxLabel({
  boxCode,
  boxNumber,
  count,
  product,
  serials = [],
}: {
  boxCode: string;
  boxNumber: number;
  count: number;
  product: string | null;
  /** Member carte serials scanned into the box (their barcodes are printed). */
  serials?: string[];
}) {
  const t = useT();
  return (
    <div
      id="print-label"
      className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-300 bg-white p-6 text-center text-black [break-inside:avoid]"
    >
      <div className="text-lg font-bold uppercase tracking-wide">
        {t("otp.box")} #{boxNumber}
      </div>
      {product && <div className="text-sm">{product}</div>}
      <div className="mt-3 flex items-center justify-center">
        <QRCodeSVG value={boxCode} size={96} level="M" />
      </div>
      <div className="mt-3 flex w-full justify-center overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full">
        <Barcode value={boxCode} format="CODE128" height={56} width={1.3} fontSize={13} margin={0} />
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        {count} {t("otp.units")}
      </div>

      {/* Member carte barcodes — a tight 3-column grid so the box contents are
          physically trackable without a scanner. */}
      {serials.length > 0 && (
        <div className="mt-3 border-t border-neutral-200 pt-3">
          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {serials.map((s) => (
              <div key={s} className="flex flex-col items-center overflow-hidden">
                <div className="flex w-full justify-center overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full">
                  <Barcode value={s} format="CODE128" height={20} width={1} displayValue={false} margin={0} />
                </div>
                <div className="mt-px font-mono text-[7px] leading-none text-neutral-700">{s}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

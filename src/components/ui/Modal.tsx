"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  /** Hide the close button / disable backdrop+Escape close (forced decision). */
  dismissible?: boolean;
  className?: string;
}

export function Modal({ open, onClose, title, children, dismissible = true, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismissible, onClose]);

  if (!open || !mounted) return null;

  // Portal to <body> so it sits outside #app-shell — lets print CSS hide the
  // app and print only the dialog's label on a single page.
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => dismissible && onClose?.()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-fade-up relative z-10 w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl",
          className,
        )}
      >
        {(title || dismissible) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {title && <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>}
            {dismissible && (
              <button
                onClick={onClose}
                className="ring-accent grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-[var(--surface-2)] hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

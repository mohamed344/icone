import { cn } from "@/lib/cn";

/** Drifting blurred gradient field. Sits behind content (z-0). */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("aurora", className)} aria-hidden>
      <span />
    </div>
  );
}

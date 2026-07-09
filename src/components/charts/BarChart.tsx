import { cn } from "@/lib/cn";

interface BarChartProps {
  labels: string[];
  values: number[];
  height?: number;
  className?: string;
}

/** Rounded vertical bars with an accent gradient. */
export function BarChart({ labels, values, height = 220, className }: BarChartProps) {
  const W = 600;
  const H = height;
  const padB = 26;
  const max = Math.max(...values) * 1.1 || 1;
  const n = values.length;
  const slot = W / n;
  const bw = Math.min(slot * 0.5, 34);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full", className)} role="img">
      {values.map((v, i) => {
        const h = (v / max) * (H - padB - 8);
        const x = i * slot + (slot - bw) / 2;
        const y = H - padB - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={8}
              width={bw}
              height={H - padB - 8}
              rx={bw / 2}
              fill="var(--border)"
              opacity="0.4"
            />
            <rect x={x} y={y} width={bw} height={h} rx={bw / 2} fill="var(--accent)" />
          </g>
        );
      })}
      {labels.map((l, i) => (
        <text
          key={l}
          x={i * slot + slot / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="11"
          fill="var(--faint)"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

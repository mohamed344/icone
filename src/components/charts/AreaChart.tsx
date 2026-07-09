import { cn } from "@/lib/cn";

interface AreaChartProps {
  labels: string[];
  current: number[];
  previous?: number[];
  height?: number;
  className?: string;
}

/** Two-series area chart (current vs previous) on a soft baseline grid. */
export function AreaChart({
  labels,
  current,
  previous,
  height = 220,
  className,
}: AreaChartProps) {
  const W = 600;
  const H = height;
  const padB = 26;
  const all = [...current, ...(previous ?? [])];
  const max = Math.max(...all) * 1.1 || 1;
  const stepX = W / (current.length - 1);

  const toPts = (data: number[]) =>
    data.map((v, i) => {
      const x = i * stepX;
      const y = H - padB - (v / max) * (H - padB - 8);
      return [x, y] as const;
    });

  const path = (pts: readonly (readonly [number, number])[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  const cur = toPts(current);
  const prev = previous ? toPts(previous) : null;
  const curArea = `${path(cur)} L${W},${H - padB} L0,${H - padB} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("w-full", className)}
      preserveAspectRatio="none"
      role="img"
    >
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* horizontal grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = 8 + t * (H - padB - 8);
        return (
          <line
            key={t}
            x1="0"
            x2={W}
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        );
      })}

      {prev && (
        <path
          d={path(prev)}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="2"
          strokeOpacity="0.4"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
      )}

      <path d={curArea} fill="url(#area-fill)" />
      <path
        d={path(cur)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* end dot */}
      <circle cx={cur[cur.length - 1][0]} cy={cur[cur.length - 1][1]} r="4" fill="var(--accent)" />

      {labels.map((l, i) => (
        <text
          key={l}
          x={i * stepX}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
          fontSize="11"
          fill="var(--faint)"
        >
          {l}
        </text>
      ))}
    </svg>
  );
}

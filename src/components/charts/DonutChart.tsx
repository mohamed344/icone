import { cn } from "@/lib/cn";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

/** SVG ring chart with a labeled hole in the middle. */
export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("relative inline-grid place-items-center", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 rtl:rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
          opacity="0.4"
        />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(len - 4, 0)} ${c - Math.max(len - 4, 0)}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            {centerValue && (
              <div className="font-display text-2xl font-semibold text-foreground">
                {centerValue}
              </div>
            )}
            {centerLabel && <div className="text-xs text-faint">{centerLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

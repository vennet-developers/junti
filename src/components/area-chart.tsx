import { integerTicks, smoothAreaPath } from "@/domain/chart";

/**
 * The trend as a smooth shape with a gradient fade — temporary mirror of
 * `@stackmyth/charts`' AreaChart (3c3c20d5); dies when the package releases.
 * The gradient id derives from the required ariaLabel, no hooks, SSR-exact.
 */
export function AreaChart({
  points,
  ariaLabel,
  showAxis = true,
}: {
  points: readonly { label: string; value: number }[];
  ariaLabel: string;
  showAxis?: boolean;
}) {
  const values = points.map((point) => point.value);
  const max = values.reduce((top, value) => Math.max(top, value), 0);
  if (points.length === 0 || max === 0) return null;

  const plot = { width: 520, height: 140 };
  const left = showAxis ? 28 : 0;
  const TOP = 8;
  const labelBand = showAxis ? 18 : 0;
  const { line, area } = smoothAreaPath(values, plot);
  const gid = `junti-area-${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const min = Math.min(...values);
  const span = max - min;
  const stepX = points.length > 1 ? plot.width / (points.length - 1) : 0;
  const lastY =
    span === 0 ? plot.height / 2 : plot.height - ((values[values.length - 1] - min) / span) * plot.height;

  return (
    <svg
      className="junti-area"
      viewBox={`0 0 ${left + plot.width} ${TOP + plot.height + labelBand}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--junti-naranja)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--junti-naranja)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {showAxis
        ? integerTicks(max).map((tick) => {
            if (tick < min) return null;
            const y = span === 0 ? TOP + plot.height / 2 : TOP + plot.height - ((tick - min) / span) * plot.height;
            return (
              <g key={tick}>
                <line className="junti-area__grid" x1={left} x2={left + plot.width} y1={y} y2={y} />
                <text className="junti-area__tick" x={left - 6} y={y + 4} textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })
        : null}

      <g transform={`translate(${left} ${TOP})`}>
        <path d={area} fill={`url(#${gid})`} />
        <path className="junti-area__line" d={line} />
        <circle
          className="junti-area__dot"
          cx={points.length > 1 ? (points.length - 1) * stepX : plot.width / 2}
          cy={lastY}
          r="3.5"
        />
      </g>

      {showAxis ? (
        <>
          <text className="junti-area__label" x={left} y={TOP + plot.height + 14}>
            {points[0].label}
          </text>
          <text
            className="junti-area__label"
            x={left + plot.width}
            y={TOP + plot.height + 14}
            textAnchor="end"
          >
            {points[points.length - 1].label}
          </text>
        </>
      ) : null}
    </svg>
  );
}

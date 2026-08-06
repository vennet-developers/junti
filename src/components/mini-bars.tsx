import { miniBarGeometry } from "@/domain/chart";

/**
 * Sparkline-sized bars; empty buckets are baseline dots. Temporary mirror of
 * `@stackmyth/charts` — the dot is the design: "measured nothing" at a
 * glance, without lying about time.
 */
export function MiniBars({ values, ariaLabel }: { values: readonly number[]; ariaLabel: string }) {
  const bars = miniBarGeometry(values, { width: 120, height: 36, gap: 3 });
  if (bars.length === 0) return null;

  return (
    <svg className="junti-minibars" viewBox="0 0 120 36" role="img" aria-label={ariaLabel}>
      {bars.map((bar, index) =>
        bar.empty ? (
          <circle key={index} className="junti-minibars__dot" cx={bar.x + bar.width / 2} cy={34.5} r="1.5" />
        ) : (
          <rect
            key={index}
            className={
              index === bars.length - 1 ? "junti-minibars__bar junti-minibars__bar--accent" : "junti-minibars__bar"
            }
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx="1.5"
          />
        ),
      )}
    </svg>
  );
}

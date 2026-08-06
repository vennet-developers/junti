import { Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { barGeometry, integerTicks, type Point } from "@/domain/chart";

/**
 * One weekly series, as bars. Plain SVG, no library, and that is a conclusion:
 * `@tanstack/charts` was tried first and hung the server render four separate
 * ways before freezing the browser at hydration — the full account is on the
 * geometry module this renders. Sixty lines of SVG render on the server, weigh
 * nothing, and cannot hang anything, because there is nothing here that loops.
 *
 * The numbers sit ON the bars rather than behind a tooltip. This page is read,
 * not hovered, and with weekly buckets there is always room for a label.
 */

export type { Point as GrowthPoint };

/** ViewBox units. The SVG scales to its container; these set the proportions. */
const BOX = { width: 520, height: 160, gap: 10 };
const AXIS_WIDTH = 28;
const LABEL_HEIGHT = 18;
/** Headroom for the value label above a bar at full height. */
const TOP = 16;

interface Props {
  title: string;
  /**
   * The series, already continuous — empty weeks arrive as zeroes, never as
   * missing rows. The query's `generate_series` guarantees it; dropping a
   * quiet week would compress the time axis and hide the very thing a growth
   * chart is read for.
   */
  points: readonly Point[];
  /** What the numbers are, for a reader who cannot see the bars. */
  ariaLabel: string;
}

export function GrowthChart({ title, points, ariaLabel }: Props) {
  const { bars, max } = barGeometry(points, BOX);

  return (
    <Stack gap="2">
      <Text variant="small" weight="semibold">
        {title}
      </Text>

      {bars.length === 0 ? (
        /*
          An empty state rather than a row of zero-height bars: "we measured
          nothing yet" and "we measured this and it was zero" should not look
          the same.
        */
        <Text variant="small" color="muted">
          Sin datos todavía.
        </Text>
      ) : (
        <svg
          viewBox={`0 0 ${AXIS_WIDTH + BOX.width} ${TOP + BOX.height + LABEL_HEIGHT}`}
          width="100%"
          role="img"
          aria-label={ariaLabel}
        >
          {/* Gridlines at whole numbers only — these count people. */}
          {integerTicks(max).map((tick) => {
            const y = TOP + BOX.height - (tick / max) * BOX.height;
            return (
              <g key={tick}>
                <line
                  x1={AXIS_WIDTH}
                  x2={AXIS_WIDTH + BOX.width}
                  y1={y}
                  y2={y}
                  stroke="var(--sm-border-default)"
                  strokeWidth="1"
                />
                <text
                  x={AXIS_WIDTH - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--sm-text-secondary)"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {bars.map((bar) => (
            <g key={bar.label}>
              {/*
                The brand orange by token, not by hex: `--junti-naranja` is
                redefined for dark mode, so the bars invert with the page.
              */}
              <rect
                x={AXIS_WIDTH + bar.x}
                y={TOP + bar.y}
                width={bar.width}
                height={bar.height}
                rx="3"
                fill="var(--junti-naranja)"
              />
              {/* The value on the bar — zero stays unlabeled: the empty week
                  is information, but "0" seven times is noise. */}
              {bar.value > 0 ? (
                <text
                  x={AXIS_WIDTH + bar.x + bar.width / 2}
                  y={TOP + bar.y - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--sm-text-primary)"
                >
                  {bar.value}
                </text>
              ) : null}
              <text
                x={AXIS_WIDTH + bar.x + bar.width / 2}
                y={TOP + BOX.height + 14}
                textAnchor="middle"
                fontSize="11"
                fill="var(--sm-text-secondary)"
              >
                {bar.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </Stack>
  );
}
